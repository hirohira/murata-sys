/**
 * チャットの投稿から報告書の章を作る（サーバー専用）
 *
 * 章の順番・写真の順番・写真の組（遠景→アップ）は投稿のとおりに固定し、
 * AIには「見出し」と「写真の組ごとの説明文」を整えてもらうだけにする。
 * AIが使えないとき（キー未設定・エラー）は、書かれたコメントをそのまま使って作る。
 */
import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';
import type { ChapterPhoto, Project, ReportChapter, ReportType } from '@/types';
import { getChapterTemplate } from '@/lib/constants';
import { QUICK_MODEL } from '@/lib/quick-report';
import { SURVEY_CLOSING_DEFAULT, SURVEY_INTRO_DEFAULT } from '@/lib/report-pages-survey';
import { SECTION_BY_KEY, photoNotesText, type ParsedChat, type ParsedGroup, type ParsedSection } from '@/lib/report-chat';

export interface ChatPlan {
  construction_name: string;
  intro: string;
  closing: string;
  sections: {
    sid: string;
    title: string;
    body: string;
    captions: string[];
    /** 組ごとの写真の並び（1始まりの番号。なければ投稿の順） */
    orders?: (number[] | null)[];
  }[];
}

/** 組の説明文の既定：組へのコメント、なければ写真ごとの解説をつなげたもの */
function groupFallbackCaption(g: ParsedGroup): string {
  return g.notes.join('\n') || photoNotesText(g.photos);
}

/** AIが返した並び順が、1〜n をちょうど1回ずつ含むときだけ使う */
function validOrder(order: unknown, n: number): number[] | null {
  if (!Array.isArray(order) || order.length !== n) return null;
  const nums = order.map((x) => Number(x));
  const set = new Set(nums);
  if (set.size !== n || nums.some((x) => !Number.isInteger(x) || x < 1 || x > n)) return null;
  return nums;
}

const MAX_IMAGES = 14;

// ─── AIを使わないときの文章 ─────────────────────────────

function defaultTitle(s: ParsedSection, multi: boolean): string {
  const def = SECTION_BY_KEY[s.key];
  if (s.key === '全景') return '全景';
  const num = multi ? `${'①②③④⑤⑥⑦⑧⑨⑩'[s.index - 1] ?? s.index}` : '';
  if (s.key === '対策') return s.topic ? `修繕工事${num}（${s.topic}）について` : `修繕工事${num}について`;
  if (s.key === '散水試験') return s.topic ? `${s.topic}について` : `散水調査${num}について`;
  if (s.key === 'その他') return s.topic ? `${s.topic}について` : 'その他';
  return s.topic ? `${s.key}${num}（${s.topic}）について` : `${def.defaultTitle.replace('について', '')}${num}について`;
}

export function fallbackPlan(parsed: ParsedChat, project: Project): ChatPlan {
  const counts = new Map<string, number>();
  parsed.sections.forEach((s) => counts.set(s.key, (counts.get(s.key) || 0) + 1));
  return {
    construction_name: project.site_name,
    intro: parsed.preface.join('\n') || SURVEY_INTRO_DEFAULT,
    closing: SURVEY_CLOSING_DEFAULT,
    sections: parsed.sections.map((s) => ({
      sid: s.sid,
      title: defaultTitle(s, (counts.get(s.key) || 0) > 1),
      body: s.notes.join('\n'),
      captions: s.groups.map((g) => groupFallbackCaption(g)),
    })),
  };
}

// ─── AIで文章を整える ─────────────────────────────

const SYSTEM = `あなたは屋根・外壁・防水工事会社（株式会社MURATA）の調査報告書を書く担当者です。
現場担当者がチャットに投稿した「区分・写真・コメント」をもとに、お客様に渡す報告書の見出しと説明文を作ります。

書き方（MURATAの実際の報告書の文体）
- 見出しは「○○について」の形。例：「1階雨漏りの状況について」「雨漏り①の原因について」「雨漏り①散水調査その2について」「雨漏りの修繕工事　提案①について」
- 説明文は丁寧語で簡潔に。例：「1階、玄関付近の天井から雨漏りが発生している状況です。」「サッシ部に散水を行いました。結果、漏水が発生しました。」「瓦を1枚剥がして内部の確認を行いました。」「〜が見受けられました。この部分が原因のひとつとなります。」
- 投稿のコメントに書かれた事実だけを使う。書かれていない数値・場所・原因を作らない
- コメントがない写真の組は、画像から分かる範囲で1文だけ書くか、空文字にする
- 話し言葉・誤字・音声入力の言い間違いは自然な文章に直す
- 写真の組の説明は1〜2文（60字程度まで）。区分全体の説明（body）は必要なときだけ、3文まで
- 写真ごとの解説（現場で話しながら撮った内容）がある組は、その解説をまとめて組の説明にする
- 並び順：写真ごとの解説がある組は、「全体（遠景）→ 部分 → アップ」の流れになるよう、組の中だけで並べ替えてよい。
  orders にその組の写真番号（1始まり）を並べた配列を入れる。並べ替えない組・解説のない組は null

出力はJSONのみ（前後に文章を付けない）：
{"construction_name":"工事名（例：○○様邸　瓦屋根雨漏り修繕工事）","intro":"はじめのページの一文","sections":[{"sid":"S1","title":"見出し","body":"区分全体の説明（なければ空）","captions":["1組目の説明","2組目の説明"],"orders":[null,[2,1,3]]}]}
sections は入力の区分と同じ数・同じ順番・同じsidで、captions と orders は各区分の写真の組と同じ数にする。`;

function buildUserPrompt(parsed: ParsedChat, project: Project, reportType: ReportType): string {
  const lines: string[] = [
    `報告書の種類：${reportType}`,
    `現場名：${project.site_name}`,
    `お客様：${project.customer_name}`,
    project.construction_type ? `工事種別：${project.construction_type}` : '',
    '',
  ];
  if (parsed.preface.length) lines.push(`【全体のメモ】${parsed.preface.join(' / ')}`, '');
  lines.push('【投稿（順番どおり）】');
  for (const s of parsed.sections) {
    lines.push(`${s.sid}｜区分：${s.label}${s.notes.length ? `｜区分のコメント：${s.notes.join(' / ')}` : ''}`);
    s.groups.forEach((g, i) => {
      lines.push(
        `  ${s.sid}-G${i + 1}｜写真${g.photos.length}枚（撮った順）｜組へのコメント：${g.notes.join(' / ') || '（なし）'}`
      );
      g.photos.forEach((ph, k) => {
        if (ph.note?.trim()) lines.push(`    写真${k + 1}の解説：${ph.note.trim()}`);
      });
    });
  }
  return lines.filter((l) => l !== '').join('\n').replace(/【投稿/, '\n【投稿');
}

function parseJson(text: string): Partial<ChatPlan> | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function planChatReport(parsed: ParsedChat, project: Project, reportType: ReportType): Promise<{ plan: ChatPlan; ai: boolean; aiError?: string }> {
  const fallback = fallbackPlan(parsed, project);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || parsed.sections.length === 0) return { plan: fallback, ai: false };

  const user = buildUserPrompt(parsed, project, reportType);
  // コメントのない組を優先して、各組の最後の写真（いちばん寄った写真）を見せる
  const imageTargets = parsed.sections
    .flatMap((s) => s.groups.map((g, i) => ({ key: `${s.sid}-G${i + 1}`, url: g.photos[g.photos.length - 1]?.url, noted: g.notes.length > 0 || g.photos.some((ph) => ph.note?.trim()) })))
    .filter((t) => t.url)
    .sort((a, b) => Number(a.noted) - Number(b.noted))
    .slice(0, MAX_IMAGES);
  const content: Anthropic.ContentBlockParam[] = [{ type: 'text', text: user }];
  if (imageTargets.length) {
    content.push({ type: 'text', text: '【写真の画像（各組の最後の1枚）】' });
    for (const t of imageTargets) {
      content.push({ type: 'text', text: t.key });
      content.push({ type: 'image', source: { type: 'url', url: t.url! } });
    }
  }

  const anthropic = new Anthropic({ apiKey });
  const ask = (c: Anthropic.ContentBlockParam[]) =>
    anthropic.messages.create({ model: QUICK_MODEL, max_tokens: 3000, system: SYSTEM, messages: [{ role: 'user', content: c }] });

  try {
    let message: Anthropic.Message;
    try {
      message = await ask(content);
    } catch (e) {
      if (imageTargets.length === 0) throw e;
      console.error('Chat report: retry without images', e);
      message = await ask([{ type: 'text', text: user }]);
    }
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    const got = parseJson(text);
    if (!got || !Array.isArray(got.sections)) throw new Error('AIの応答を読み取れませんでした');

    // 区分・組の数は投稿のとおりに合わせる（AIの結果が欠けていたら元のコメントで補う）
    const bySid = new Map(got.sections.map((s) => [String(s?.sid), s]));
    const plan: ChatPlan = {
      construction_name: (got.construction_name || '').trim().slice(0, 60) || fallback.construction_name,
      intro: (got.intro || '').trim().slice(0, 200) || fallback.intro,
      closing: SURVEY_CLOSING_DEFAULT,
      sections: fallback.sections.map((f) => {
        const s = bySid.get(f.sid);
        const caps = Array.isArray(s?.captions) ? s!.captions : [];
        return {
          sid: f.sid,
          title: (typeof s?.title === 'string' && s.title.trim().slice(0, 40)) || f.title,
          body: typeof s?.body === 'string' ? s.body.trim().slice(0, 300) : f.body,
          captions: f.captions.map((fc, i) => (typeof caps[i] === 'string' ? caps[i].trim().slice(0, 160) : fc)),
          orders: Array.isArray(s?.orders) ? s!.orders.map((o) => (Array.isArray(o) ? o : null)) : undefined,
        };
      }),
    };
    return { plan, ai: true };
  } catch (e) {
    console.error('Chat report AI failed:', e);
    return { plan: fallback, ai: false, aiError: e instanceof Error ? e.message : String(e) };
  }
}

// ─── 章を組み立てる ─────────────────────────────

export function buildChatChapters(parsed: ParsedChat, plan: ChatPlan, reportType: ReportType, project: Project): ReportChapter[] {
  const planBySid = new Map(plan.sections.map((s) => [s.sid, s]));
  let groupNo = 0;
  const chapterPhotos = (s: ParsedSection): ChapterPhoto[] => {
    const p = planBySid.get(s.sid);
    const out: ChapterPhoto[] = [];
    s.groups.forEach((g, gi) => {
      groupNo += 1;
      const caption = p?.captions[gi] ?? groupFallbackCaption(g);
      // AIの並び順は、写真ごとの解説がある組だけ使う（解説のない組は撮った順のまま）
      const hasNotes = g.photos.some((ph) => ph.note?.trim());
      const order = hasNotes ? validOrder(p?.orders?.[gi], g.photos.length) : null;
      const photos = order ? order.map((k) => g.photos[k - 1]) : g.photos;
      photos.forEach((ph, i) => {
        out.push({
          id: randomUUID(),
          url: ph.url,
          path: ph.path,
          // 組の説明は組の最後の写真に付ける（報告書ではその段の下に出る）
          caption: i === photos.length - 1 ? caption : '',
          sort_order: out.length,
          group: groupNo,
        });
      });
    });
    return out;
  };
  const make = (key: string, title: string, description: string, photos: ChapterPhoto[], ai: boolean): ReportChapter => ({
    id: randomUUID(),
    key,
    title,
    description,
    photos,
    ai_generated: ai,
    sort_order: 0,
  });

  const template = getChapterTemplate(reportType, project.building_type, project.construction_type);
  const fixed = (key: string) => template.find((t) => t.key === key)?.title || key;

  const chapters: ReportChapter[] = [make('cover', fixed('cover'), '', [], false)];

  // 全景はまとめて「はじめ」のページへ
  const overviewSections = parsed.sections.filter((s) => s.key === '全景');
  const overviewPhotos = overviewSections.flatMap((s) => chapterPhotos(s));
  chapters.push(make('overview', '全景', plan.intro, overviewPhotos, true));

  let n = 0;
  for (const s of parsed.sections) {
    if (s.key === '全景') continue;
    n += 1;
    const p = planBySid.get(s.sid);
    chapters.push(make(`chat_${n}`, p?.title || s.label, p?.body ?? s.notes.join('\n'), chapterPhotos(s), true));
  }

  chapters.push(make('closing', 'おわりに', plan.closing, [], false));
  if (reportType === '調査報告書') chapters.push(make('schedule', fixed('schedule'), '', [], false));
  chapters.push(make('company', fixed('company'), '', [], false));
  chapters.forEach((c, i) => (c.sort_order = i));
  return chapters;
}
