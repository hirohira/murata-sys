// サーバー専用：「シナリオ＋区分ごとの写真」から報告書をボタン一つで作る
//
// 写真の集め方
//   1. 案件の「写真」タブでアップした写真（report_photos。区分付き）
//   2. Googleドライブの現場フォルダ「03_現場調査」に直接入れた写真
//      区分はフォルダ名かファイル名から読む（例：03_現場調査/原因/原因2/xxx.jpg、原因1_棟板金.jpg）
//      完了報告書では「05_施工写真」なども対象にする
// AIはシナリオと写真の一覧（区分・番号・ファイル名・撮影日時）から章立て・写真の割り当て・文章を作る
import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';
import type { createServerSupabaseClient } from '@/lib/supabase/server';
import type { ChapterPhoto, PhotoCategory, PhotoTag, Project, ReportChapter, ReportType } from '@/types';
import { PHOTO_CATEGORIES, getChapterTemplate } from '@/lib/constants';
import {
  ensureFolder,
  fetchImage,
  findChild,
  FOLDER_MIME,
  isDriveConfigured,
  listImagesRecursive,
  PHOTO_SOURCE_FOLDERS,
  tagFromFolderPath,
} from '@/lib/google-drive';
import { ensureProjectDriveFolder } from '@/lib/project-drive';
import { PHOTO_DRIVE_PARENT } from '@/lib/project-photos';

type Supabase = ReturnType<typeof createServerSupabaseClient>;

export const QUICK_MODEL = 'claude-haiku-4-5-20251001';
const MAX_PHOTOS_FOR_AI = 40;
const MAX_PHOTOS_PER_CHAPTER = 6;

export interface SourcePhoto {
  key: string; // AIに渡す短いID（P1, P2…）
  source: 'app' | 'drive';
  category: PhotoCategory;
  group: number | null; // 「原因1」「原因2」などの番号
  tag?: PhotoTag;
  label: string; // フォルダ・ファイル名（AIへの手がかり）
  takenAt: string | null;
  // app の写真
  url?: string;
  path?: string;
  caption?: string | null;
  // drive の写真
  driveFileId?: string;
}

const CAT_RE = /(現状|原因|対策|その他)\s*([0-9０-９]{1,2})?/;

function toHalfWidth(s: string) {
  return s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

/** フォルダ名・ファイル名から区分と番号を読む（ファイル名は先頭の「原因1_」の形だけを見る） */
export function categoryFromDrivePath(folderPath: string, fileName: string): { category: PhotoCategory | null; group: number | null } {
  let category: PhotoCategory | null = null;
  let group: number | null = null;
  for (const seg of folderPath.split('/')) {
    const m = seg.match(new RegExp(`^${CAT_RE.source}$`));
    if (m) {
      category = m[1] as PhotoCategory;
      if (m[2]) group = Number(toHalfWidth(m[2]));
    }
  }
  const fm = fileName.match(/^(現状|原因|対策|その他)\s*([0-9０-９]{1,2})?[_\-\s・．.]/);
  if (fm) {
    category = fm[1] as PhotoCategory;
    if (fm[2]) group = Number(toHalfWidth(fm[2]));
  }
  // 完了報告書用：05_施工写真の施工前・施工後
  if (!category) {
    const tag = tagFromFolderPath(folderPath);
    if (tag === 'before') category = '現状';
    if (tag === 'after') category = '対策';
  }
  return { category, group };
}

/** 写真の区分フォルダ（03_現場調査/現状・原因・対策・その他）を用意して、そのURLを返す */
export async function ensureCategoryFolders(supabase: Supabase, project: Project) {
  const site = await ensureProjectDriveFolder(supabase, project);
  const parent = await ensureFolder(site.id, PHOTO_DRIVE_PARENT);
  for (const c of PHOTO_CATEGORIES) await ensureFolder(parent, c);
  return { siteFolderUrl: site.url, photoFolderId: parent, photoFolderUrl: `https://drive.google.com/drive/folders/${parent}` };
}

/** 報告書に使える写真を集める */
export async function collectPhotos(
  supabase: Supabase,
  project: Project,
  reportType: ReportType
): Promise<{ photos: SourcePhoto[]; driveError: string | null; photoFolderUrl: string | null }> {
  const photos: SourcePhoto[] = [];
  const { data: rows } = await supabase
    .from('report_photos')
    .select('*')
    .eq('project_id', project.id)
    .order('taken_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });
  const knownDriveIds = new Set<string>();
  for (const r of rows ?? []) {
    if (r.drive_file_id) knownDriveIds.add(r.drive_file_id);
    photos.push({
      key: '',
      source: 'app',
      category: (PHOTO_CATEGORIES as string[]).includes(r.category) ? r.category : 'その他',
      group: null,
      label: r.drive_file_name || r.caption || '',
      takenAt: r.taken_at || r.created_at,
      url: r.file_url,
      path: r.file_path,
      caption: r.caption,
    });
  }

  let driveError: string | null = null;
  let photoFolderUrl: string | null = null;
  if (isDriveConfigured()) {
    try {
      const folders = await ensureCategoryFolders(supabase, project);
      photoFolderUrl = folders.photoFolderUrl;
      const site = await ensureProjectDriveFolder(supabase, project);
      const sources = reportType === '完了報告書' ? PHOTO_SOURCE_FOLDERS : [PHOTO_DRIVE_PARENT];
      for (const name of sources) {
        const folder = await findChild(site.id, name, FOLDER_MIME);
        if (!folder?.id) continue;
        const files = await listImagesRecursive(folder.id, name);
        for (const f of files) {
          if (knownDriveIds.has(f.id)) continue; // アプリから上げた写真と同じもの
          const { category, group } = categoryFromDrivePath(f.folderPath, f.name);
          photos.push({
            key: '',
            source: 'drive',
            category: category ?? 'その他',
            group,
            tag: tagFromFolderPath(f.folderPath),
            label: `${f.folderPath}/${f.name}`,
            takenAt: f.modifiedTime ?? null,
            driveFileId: f.id,
          });
        }
      }
    } catch (e) {
      console.error('Quick report drive listing failed:', e);
      driveError = e instanceof Error ? e.message : 'ドライブの写真を読み込めませんでした';
    }
  }

  // 区分 → 番号 → 撮影順
  const order = (c: PhotoCategory) => PHOTO_CATEGORIES.indexOf(c);
  photos.sort(
    (a, b) =>
      order(a.category) - order(b.category) ||
      (a.group ?? 0) - (b.group ?? 0) ||
      (a.takenAt ?? '').localeCompare(b.takenAt ?? '')
  );
  photos.forEach((p, i) => (p.key = `P${i + 1}`));
  return { photos, driveError, photoFolderUrl };
}

/** 区分ごとの枚数（画面表示用） */
export function summarizePhotos(photos: SourcePhoto[]) {
  const map = new Map<string, number>();
  for (const p of photos) {
    const k = p.group ? `${p.category}${p.group}` : p.category;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([label, count]) => ({ label, count }));
}

// ─── AI ───────────────────────────────────────────

interface AiChapter {
  key: string;
  title: string;
  description: string;
  photos: { id: string; caption?: string }[];
}
interface AiResult {
  construction_name?: string;
  purpose?: string;
  chapters: AiChapter[];
}

function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('AIの応答を読み取れませんでした');
  return JSON.parse(text.slice(start, end + 1));
}

export async function planReport(params: {
  project: Project;
  reportType: ReportType;
  scenario: string;
  photos: SourcePhoto[];
}): Promise<AiResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY が設定されていません');
  const { project, reportType, scenario } = params;
  const photos = params.photos.slice(0, MAX_PHOTOS_FOR_AI);
  const isSurvey = reportType === '調査報告書';

  const template = getChapterTemplate(reportType, project.building_type, project.construction_type).filter(
    (t) => !['cover', 'schedule', 'company'].includes(t.key)
  );
  const templateText = template.map((t) => `- ${t.key}：${t.title}`).join('\n');
  const photoText =
    photos.length > 0
      ? photos
          .map(
            (p) =>
              `${p.key}｜区分=${p.category}${p.group ? p.group : ''}${p.tag ? `（${p.tag === 'before' ? '施工前' : '施工後'}）` : ''}｜${p.label || '名前なし'}${p.takenAt ? `｜${p.takenAt.slice(0, 16).replace('T', ' ')}` : ''}`
          )
          .join('\n')
      : '（写真なし）';

  const audience =
    project.audience_type === '建築関係者向け'
      ? '建築の専門家向けに、技術用語を適切に使い簡潔に書く。'
      : '一般の施主にも分かる言葉で書く。専門用語には短い補足を添える。';

  const system = `あなたは株式会社MURATA（板金・屋根・外壁・防水工事）の${isSurvey ? '調査報告書' : '完了報告書'}を作る担当者です。
担当者が書いた「シナリオ」と、区分ごとに整理された現場写真の一覧から、報告書の章立て・各章の写真・文章を決めます。
報告書は「全体の把握 → 対象部位・不具合 → 原因 → 対策 → 提案」という、お客様目線の流れで構成します。
シナリオに書かれていない事実（寸法・数量・金額・材料名など）は作らないこと。分からないところは一般的で控えめな表現にすること。`;

  const user = `【現場】${project.customer_name}／${project.site_name}／${project.construction_type}／${project.building_type}${project.address ? `／${project.address}` : ''}

【シナリオ（担当者の入力）】
${scenario.trim() || '（入力なし。写真の区分とファイル名から、控えめな内容で作成する）'}

【写真の一覧】（ID｜区分｜フォルダ・ファイル名｜日時）
${photoText}

【使える章（key：標準の題名）】
${templateText}

【決まり】
- 章は上の順番で並べる。内容がない章は出さない。
- 原因が複数あるときは、原因ごとに key「cause」の章を分ける（題名の例：「原因の特定①　棟板金の浮き」）。対策も原因ごとに分けてよい（key「measures」）。
- 写真の割り当て：区分「現状」→全体の把握・不具合の章、「原因」→原因の章（「原因1」「原因2」の番号があれば、その番号の原因の章へ）、「対策」→対策・提案の章、「その他」→内容に合う章。番号がない原因の写真が複数あるときは、シナリオの原因の順番と撮影順を手がかりに割り当てる。
- 1つの写真は1つの章にだけ使う。1章あたり写真は${MAX_PHOTOS_PER_CHAPTER}枚まで。合わない写真は使わなくてよい。
- 各写真にキャプション（15字以内。例：「棟板金の浮き」）を付ける。
- 文章（description）：写真のある章は写真の下に添える1〜2文・70字以内。提案（proposal）・施工内容（work）・保証（warranty）の章は「工事内容として」の後に「・」で始まる箇条書きを含め200字以内。
- ${audience}
- construction_name は表紙の工事名（例：「○○様邸　屋根改修工事」）、purpose は調査・工事の目的を1文で。

【出力】次のJSONだけを返す（前置き・説明は不要）。
{"construction_name":"...","purpose":"...","chapters":[{"key":"overview","title":"...","description":"...","photos":[{"id":"P1","caption":"..."}]}]}`;

  const anthropic = new Anthropic({ apiKey });
  const message = await anthropic.messages.create({
    model: QUICK_MODEL,
    max_tokens: 4000,
    system,
    messages: [{ role: 'user', content: user }],
  });
  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
  const parsed = extractJson(text) as AiResult;
  if (!Array.isArray(parsed.chapters)) throw new Error('AIの応答に章がありませんでした');
  return parsed;
}

// ─── 写真の取り込みと章の組み立て ─────────────────────────

/** ドライブの写真を報告書用に取り込み（長辺2000px）、Storage のURLを返す */
async function importDrivePhoto(supabase: Supabase, project: Project, userId: string, fileId: string) {
  const image = await fetchImage(fileId, 2000);
  const ext = image.mimeType.includes('png') ? 'png' : 'jpg';
  const path = `${userId}/${project.id}/drive_${fileId}.${ext}`;
  const { error } = await supabase.storage
    .from('report-photos')
    .upload(path, image.data, { contentType: image.mimeType, upsert: true, cacheControl: '3600' });
  if (error) throw new Error(error.message);
  const {
    data: { publicUrl },
  } = supabase.storage.from('report-photos').getPublicUrl(path);
  return { url: publicUrl, path };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    })
  );
  return out;
}

export async function buildChapters(params: {
  supabase: Supabase;
  project: Project;
  userId: string;
  reportType: ReportType;
  plan: AiResult;
  photos: SourcePhoto[];
}): Promise<{ chapters: ReportChapter[]; usedPhotos: number; failedPhotos: number }> {
  const { supabase, project, userId, reportType, plan, photos } = params;
  const byKey = new Map(photos.map((p) => [p.key, p]));
  const used = new Set<string>();

  // AIが選んだ写真（重複・存在しないIDは除く）
  const aiChapters = plan.chapters.map((c) => ({
    ...c,
    photos: (c.photos || [])
      .filter((ph) => byKey.has(ph.id) && !used.has(ph.id) && used.add(ph.id))
      .slice(0, MAX_PHOTOS_PER_CHAPTER),
  }));

  // ドライブの写真だけ取り込む
  const driveKeys = Array.from(used).filter((k) => byKey.get(k)!.source === 'drive');
  const imported = new Map<string, { url: string; path: string } | null>();
  await mapLimit(driveKeys, 4, async (k) => {
    try {
      imported.set(k, await importDrivePhoto(supabase, project, userId, byKey.get(k)!.driveFileId!));
    } catch (e) {
      console.error('Quick report photo import failed:', k, e);
      imported.set(k, null);
    }
  });

  let failed = 0;
  const toChapterPhoto = (id: string, caption: string | undefined, i: number): ChapterPhoto | null => {
    const src = byKey.get(id)!;
    const loc = src.source === 'app' ? { url: src.url!, path: src.path! } : imported.get(id);
    if (!loc) {
      failed++;
      return null;
    }
    return {
      id: randomUUID(),
      url: loc.url,
      path: loc.path,
      caption: (caption || src.caption || '').slice(0, 30),
      sort_order: i,
      tag: src.tag,
    };
  };

  // ひな形の順に並べ、AIの章をその位置に入れる（同じkeyの章が複数あれば続けて入れる）
  const template = getChapterTemplate(reportType, project.building_type, project.construction_type);
  const chapters: ReportChapter[] = [];
  const pushChapter = (key: string, title: string, description: string, chPhotos: ChapterPhoto[], ai: boolean) =>
    chapters.push({
      id: randomUUID(),
      key,
      title,
      description,
      photos: chPhotos,
      ai_generated: ai,
      sort_order: chapters.length,
    });

  const remaining = [...aiChapters];
  for (const t of template) {
    if (['cover', 'schedule', 'company'].includes(t.key)) {
      pushChapter(t.key, t.title, '', [], false);
      continue;
    }
    const matches = remaining.filter((c) => c.key === t.key);
    for (const c of matches) {
      remaining.splice(remaining.indexOf(c), 1);
      const ps = c.photos.map((p, i) => toChapterPhoto(p.id, p.caption, i)).filter((p): p is ChapterPhoto => !!p);
      pushChapter(t.key, c.title?.trim() || t.title, (c.description || '').trim(), ps, true);
    }
  }
  // ひな形にないkeyの章は、会社案内などの固定ページの前に入れる
  for (const c of remaining) {
    const ps = c.photos.map((p, i) => toChapterPhoto(p.id, p.caption, i)).filter((p): p is ChapterPhoto => !!p);
    const at = chapters.findIndex((x) => x.key === 'schedule' || x.key === 'company');
    const ch: ReportChapter = {
      id: randomUUID(),
      key: c.key || 'custom',
      title: c.title || '追加の章',
      description: (c.description || '').trim(),
      photos: ps,
      ai_generated: true,
      sort_order: 0,
    };
    if (at >= 0) chapters.splice(at, 0, ch);
    else chapters.push(ch);
  }
  chapters.forEach((c, i) => (c.sort_order = i));

  return { chapters, usedPhotos: used.size - failed, failedPhotos: failed };
}
