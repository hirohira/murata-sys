/**
 * 報告書ページの組み立て（茂様式：MURATA様の実物の調査報告書に合わせたレイアウト）
 *
 * プレビュー（ReportSlidePreview）と PowerPoint 出力（report-pptx）は、
 * どちらもここで作る「ページ＝図形の一覧」をそのまま描画する。単位はインチ（10 × 7.5）。
 *
 * ページ構成
 *   1. 表紙（ご提案書／完了報告書）
 *   2. 全体把握（写真1枚なら大きく1枚＋一文）
 *   3. 写真ページ … 1ページを上下に分け、「■見出し＋写真最大3枚＋コメント」を2項目ずつ
 *      コメントが半ページに収まらない項目は1ページを使う
 *   4. 工事日数・特記事項（調査報告書は常に出力）
 *   5. 会社案内（常に出力）
 */
import type { ChapterPhoto, Project, Report, ReportChapter } from '@/types';
import { MURATA_COMPANY, STANDARD_SPECIAL_NOTES, DEFAULT_WORK_HOURS } from '@/lib/constants';
import { stripChapterNumber, hasChapterContent } from '@/lib/chapter-numbering';

export const SLIDE_W = 10;
export const SLIDE_H = 7.5;

export type AssetKey =
  | 'logoMurata'
  | 'logoAmamoriDr'
  | 'mascot'
  | 'logoCert'
  | 'bgWatermark'
  | 'badges'
  | 'qrAmamoriDr'
  | 'qrFactory'
  | 'qrSteelArch';

export const ASSET_PATH: Record<AssetKey, string> = {
  logoMurata: '/report-assets/logo-murata.png',
  logoAmamoriDr: '/report-assets/logo-amamori-dr.png',
  mascot: '/report-assets/mascot.png',
  logoCert: '/report-assets/logo-cert.png',
  bgWatermark: '/report-assets/bg-watermark.png',
  badges: '/report-assets/badges.png',
  qrAmamoriDr: '/report-assets/qr-amamori-dr.png',
  qrFactory: '/report-assets/qr-factory.png',
  qrSteelArch: '/report-assets/qr-steel-arch.png',
};

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Paragraph {
  text: string;
  bold?: boolean;
  color?: string; // 'RRGGBB'
}

export type Element =
  | { kind: 'asset'; asset: AssetKey; box: Box }
  | { kind: 'photo'; photo: ChapterPhoto; box: Box; badge?: { text: string; color: string } }
  | { kind: 'line'; box: Box; color: string; widthPt: number } // 水平線（box.h は 0）
  | {
      kind: 'text';
      box: Box;
      paragraphs: Paragraph[];
      fontSize: number;
      lineSpacing: number; // 行間（文字サイズに対する倍率。描画側でpt指定に変換）
      bold?: boolean;
      underline?: boolean;
      color?: string;
      align: 'left' | 'center' | 'right';
      valign: 'top' | 'middle' | 'bottom';
      font?: 'body' | 'rounded';
    };

export interface Page {
  elements: Element[];
}

const RED = 'FF0000';
const TEXT = '222222';

// ─── 文字を枠に収める ─────────────────────────────

function charWidth(ch: string): number {
  return /[\u0000-ÿ｡-ﾟ]/.test(ch) ? 0.55 : 1;
}

function countLines(text: string, widthIn: number, fontPt: number): number {
  const lineUnits = (widthIn * 72) / fontPt;
  let lines = 0;
  for (const para of text.split('\n')) {
    let used = 0;
    let n = 1;
    for (const ch of para) {
      const w = charWidth(ch);
      if (used + w > lineUnits) {
        n += 1;
        used = w;
      } else {
        used += w;
      }
    }
    lines += n;
  }
  return lines;
}

function maxLines(heightIn: number, fontPt: number, lineSpacing: number): number {
  return Math.floor((heightIn * 72 * 0.92) / (fontPt * lineSpacing));
}

/** 文字サイズの候補から収まる最大のものを選ぶ。最小でも溢れる場合は末尾を「…」で省略 */
export function fitParagraphs(
  paragraphs: Paragraph[],
  box: Box,
  sizes: number[],
  lineSpacing: number
): { paragraphs: Paragraph[]; fontSize: number; truncated: boolean } {
  const total = (ps: Paragraph[], size: number) =>
    ps.reduce((n, p) => n + countLines(p.text, box.w, size), 0);

  for (const size of sizes) {
    if (total(paragraphs, size) <= maxLines(box.h, size, lineSpacing)) {
      return { paragraphs, fontSize: size, truncated: false };
    }
  }

  const size = sizes[sizes.length - 1];
  const limit = Math.max(1, maxLines(box.h, size, lineSpacing));
  const out: Paragraph[] = [];
  let used = 0;
  for (const p of paragraphs) {
    const lines = countLines(p.text, box.w, size);
    if (used + lines <= limit) {
      out.push(p);
      used += lines;
      continue;
    }
    const remain = limit - used;
    if (remain > 0) {
      let lo = 0;
      let hi = p.text.length;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (countLines(p.text.slice(0, mid) + '…', box.w, size) <= remain) lo = mid;
        else hi = mid - 1;
      }
      out.push({ ...p, text: p.text.slice(0, lo).trimEnd() + '…' });
    }
    break;
  }
  return { paragraphs: out, fontSize: size, truncated: true };
}

function text(
  box: Box,
  paragraphs: Paragraph[] | string,
  opts: {
    sizes: number[];
    lineSpacing?: number;
    bold?: boolean;
    underline?: boolean;
    color?: string;
    align?: 'left' | 'center' | 'right';
    valign?: 'top' | 'middle' | 'bottom';
    font?: 'body' | 'rounded';
  }
): Extract<Element, { kind: 'text' }> {
  const ps = typeof paragraphs === 'string' ? paragraphs.split('\n').map((t) => ({ text: t })) : paragraphs;
  const lineSpacing = opts.lineSpacing ?? 1.35;
  const fit = fitParagraphs(ps, box, opts.sizes, lineSpacing);
  return {
    kind: 'text',
    box,
    paragraphs: fit.paragraphs,
    fontSize: fit.fontSize,
    lineSpacing,
    bold: opts.bold,
    underline: opts.underline,
    color: opts.color ?? TEXT,
    align: opts.align ?? 'left',
    valign: opts.valign ?? 'top',
    font: opts.font,
  };
}

// ─── 共通の枠（上下の赤線・背景の透かし・フッター） ─────────────

function chrome(pageNumber: number): Element[] {
  return [
    { kind: 'asset', asset: 'bgWatermark', box: { x: 0, y: 0.18, w: 10, h: 6.32 } },
    { kind: 'line', box: { x: 0, y: 0.2, w: 10, h: 0 }, color: RED, widthPt: 3 },
    { kind: 'line', box: { x: 0, y: 7.3, w: 10, h: 0 }, color: RED, widthPt: 3 },
    { kind: 'asset', asset: 'logoMurata', box: { x: 0.05, y: 6.89, w: 1.54, h: 0.33 } },
    { kind: 'asset', asset: 'logoCert', box: { x: 1.63, y: 6.89, w: 0.43, h: 0.32 } },
    { kind: 'asset', asset: 'logoAmamoriDr', box: { x: 7.97, y: 6.88, w: 1.38, h: 0.34 } },
    { kind: 'asset', asset: 'mascot', box: { x: 9.35, y: 6.73, w: 0.39, h: 0.48 } },
    text({ x: 4.3, y: 6.92, w: 1.4, h: 0.3 }, String(pageNumber), {
      sizes: [10],
      color: '888888',
      align: 'center',
      valign: 'middle',
    }),
  ];
}

// ─── 日付などの整形 ─────────────────────────────

function formatJpDate(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value.length <= 10 ? `${value}T00:00:00+09:00` : value);
  if (Number.isNaN(d.getTime())) return value;
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}年${jst.getUTCMonth() + 1}月${jst.getUTCDate()}日`;
}

function withHonorific(name: string): string {
  const n = name.trim();
  if (!n) return '';
  return /(様|御中|殿)$/.test(n) ? n : `${n}　御中`;
}

// ─── 各ページ ─────────────────────────────────

function coverPage(report: Report, project?: Project | null): Element[] {
  const meta = report.meta ?? {};
  const isSurvey = report.report_type === '調査報告書';
  const projectName = meta.construction_name?.trim() || report.title;
  const addressee = withHonorific(meta.addressee || (project ? `${project.customer_name}　様` : ''));
  const info: Paragraph[] = [];
  if (project?.address) info.push({ text: `現場住所：${project.address}` });
  if (isSurvey) {
    if (meta.survey_date) info.push({ text: `調査日　：${formatJpDate(meta.survey_date)}` });
  } else {
    info.push({ text: `作成日　：${formatJpDate(report.created_at)}` });
  }

  return [
    text({ x: 1.5, y: 0.9, w: 7, h: 0.75 }, isSurvey ? 'ご提案書' : '完了報告書', {
      sizes: [28],
      bold: true,
      align: 'center',
      valign: 'middle',
    }),
    text({ x: 0.8, y: 2.35, w: 8.4, h: 0.7 }, projectName, {
      sizes: [20, 18, 16, 14],
      bold: true,
      underline: true,
      align: 'center',
      valign: 'middle',
    }),
    ...(addressee
      ? [text({ x: 1.5, y: 4.05, w: 7, h: 0.5 }, addressee, { sizes: [16, 14], align: 'center', valign: 'middle' })]
      : []),
    ...(info.length
      ? [text({ x: 2.6, y: 5.35, w: 5.6, h: 0.9 }, info, { sizes: [12, 11, 10], align: 'left', valign: 'top' })]
      : []),
  ];
}

/** 全体把握：写真1枚を大きく、その下に一文 */
function overviewPage(chapter: ReportChapter): Element[] {
  const photo = chapter.photos[0];
  const lead = chapter.description?.trim() || '';
  return [
    ...(photo ? [{ kind: 'photo' as const, photo, box: { x: 1.85, y: 0.62, w: 6.3, h: 4.72 } }] : []),
    ...(lead
      ? [text({ x: 0.6, y: 5.45, w: 8.8, h: 1.2 }, lead, { sizes: [14, 13, 12, 11], bold: true, align: 'center' })]
      : []),
  ];
}

// 写真ページの1項目（半ページ or 1ページ）
interface Block {
  title: string;
  photos: ChapterPhoto[];
  description: string;
  full: boolean;
}

const PHOTO_W = 3.15;
const PHOTO_H = 2.36;
const PHOTO_GAP = 0.13;
const HALF_OFFSET = 3.35;

function photoBadge(p: ChapterPhoto) {
  if (p.tag === 'before') return { text: '施工前', color: 'E65100' };
  if (p.tag === 'after') return { text: '施工後', color: '2E7D32' };
  return undefined;
}

function photoRow(photos: ChapterPhoto[], y: number, w = PHOTO_W, h = PHOTO_H): Element[] {
  const n = photos.length;
  const total = n * w + (n - 1) * PHOTO_GAP;
  const start = (SLIDE_W - total) / 2;
  return photos.map((photo, i) => ({
    kind: 'photo' as const,
    photo,
    box: { x: start + i * (w + PHOTO_GAP), y, w, h },
    badge: photoBadge(photo),
  }));
}

function heading(title: string, y: number): Element {
  return text({ x: 0.26, y, w: 9.4, h: 0.34 }, `■ ${title}`, {
    sizes: [14, 13, 12],
    bold: true,
    underline: true,
    valign: 'middle',
  });
}

const COMMENT_SIZES = [14, 13, 12, 11];

function halfCommentBox(off: number): Box {
  return { x: 0.5, y: 2.98 + off, w: 9, h: 0.6 };
}

/** コメントが半ページの枠（2行程度）に収まるか */
function fitsHalf(description: string): boolean {
  if (!description.trim()) return true;
  return !fitParagraphs([{ text: description.trim() }], halfCommentBox(0), COMMENT_SIZES, 1.3).truncated;
}

function halfBlockElements(b: Block, off: number): Element[] {
  const els: Element[] = [heading(b.title, 0.26 + off)];
  if (b.photos.length > 0) {
    els.push(...photoRow(b.photos, 0.6 + off));
    if (b.description.trim()) {
      els.push(text(halfCommentBox(off), b.description.trim(), { sizes: COMMENT_SIZES, lineSpacing: 1.3, align: 'center' }));
    }
  } else if (b.description.trim()) {
    els.push(
      text({ x: 0.5, y: 0.7 + off, w: 9, h: 2.85 }, b.description.trim(), { sizes: [14, 13, 12, 11, 10], lineSpacing: 1.4 })
    );
  }
  return els;
}

function fullBlockElements(b: Block): Element[] {
  const els: Element[] = [heading(b.title, 0.26)];
  const desc = b.description.trim();
  if (b.photos.length <= 1) {
    // 実物の「工事内容として」と同じ：写真1枚を中央に大きく、その下に説明文
    if (b.photos[0]) els.push({ kind: 'photo', photo: b.photos[0], box: { x: 2.64, y: 0.62, w: 4.72, h: 3.54 }, badge: photoBadge(b.photos[0]) });
    if (desc) {
      const box = b.photos[0] ? { x: 1.4, y: 4.3, w: 7.2, h: 2.4 } : { x: 0.6, y: 0.75, w: 8.8, h: 5.9 };
      els.push(text(box, desc, { sizes: [14, 13, 12, 11, 10, 9], lineSpacing: 1.4 }));
    }
  } else {
    els.push(...photoRow(b.photos, 0.6));
    if (desc) els.push(text({ x: 0.5, y: 3.1, w: 9, h: 3.55 }, desc, { sizes: [14, 13, 12, 11, 10, 9], lineSpacing: 1.4 }));
  }
  return els;
}

/** 章を写真ページの項目に分ける（写真は3枚ずつ。説明文は最後の項目に付ける） */
function chapterBlocks(chapter: ReportChapter): Block[] {
  const title = stripChapterNumber(chapter.title || '');
  // 施工前→施工後の順に並べる
  const photos = [...(chapter.photos || [])].sort(
    (a, b) => (a.tag === 'before' ? 0 : a.tag === 'after' ? 2 : 1) - (b.tag === 'before' ? 0 : b.tag === 'after' ? 2 : 1)
  );
  const chunks: ChapterPhoto[][] = [];
  for (let i = 0; i < photos.length; i += 3) chunks.push(photos.slice(i, i + 3));
  if (chunks.length === 0) chunks.push([]);

  const description = chapter.description || '';
  return chunks.map((chunk, i) => {
    const last = i === chunks.length - 1;
    const desc = last ? description : '';
    const full = last && desc.trim().length > 0 && !fitsHalf(desc);
    return { title: i === 0 ? title : `${title}（続き）`, photos: chunk, description: desc, full };
  });
}

function schedulePage(report: Report, chapter: ReportChapter | undefined, worker: string | null): Element[] {
  const meta = report.meta ?? {};
  const label = (t: string): Paragraph => ({ text: `【${t}】`, bold: true });
  const blank: Paragraph = { text: '' };
  const extraNotes = (chapter?.description || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => ({ text: l.startsWith('・') ? l : `・${l}` }));

  const ps: Paragraph[] = [
    label('案件名'),
    { text: meta.construction_name?.trim() || report.title, bold: true },
    blank,
    label('見積番号'),
    { text: meta.estimate_no?.trim() ? `No.${meta.estimate_no.trim().replace(/^No\.?/i, '')}` : '　', bold: true },
    blank,
    label('工事日数と作業時間'),
    { text: `工事日数は　${meta.work_days?.trim() || '　日～　日'}　程度（人員数や雨天により変更あり）` },
    { text: `作業時間　${meta.work_hours?.trim() || DEFAULT_WORK_HOURS}　予定` },
    blank,
    label('特記事項'),
    ...STANDARD_SPECIAL_NOTES.map((n) => ({ text: `・${n.text}`, color: n.red ? RED : undefined })),
    ...extraNotes,
    blank,
    label('施工業者'),
    { text: MURATA_COMPANY.contractorLine },
    blank,
    label('担当者'),
    {
      text: `氏名：${meta.staff_name?.trim() || worker || '　'}${meta.staff_tel?.trim() ? `　TEL：${meta.staff_tel.trim()}` : ''}`,
    },
    blank,
    label('作成日'),
    { text: formatJpDate(report.created_at) },
  ];

  return [
    text({ x: 0.35, y: 0.35, w: 9.2, h: 6.4 }, ps, {
      sizes: [11, 10.5, 10, 9.5, 9],
      lineSpacing: 1.25,
      font: 'rounded',
    }),
  ];
}

function companyPage(): Element[] {
  const c = MURATA_COMPANY;
  const els: Element[] = [
    text({ x: 0.43, y: 0.35, w: 9.2, h: 0.5 }, c.slogan, { sizes: [20, 18, 16], bold: true, underline: true, valign: 'middle' }),
  ];

  // 工事種別（2列）
  els.push(text({ x: 0.43, y: 0.95, w: 4.5, h: 0.3 }, '【工事種別】', { sizes: [15], bold: true }));
  const left = c.services.filter((_, i) => i % 2 === 0);
  const right = c.services.filter((_, i) => i % 2 === 1);
  els.push(text({ x: 0.43, y: 1.27, w: 3.6, h: 2.2 }, left.map((s) => ({ text: `◇ ${s}` })), { sizes: [12, 11], lineSpacing: 1.3 }));
  els.push(text({ x: 4.1, y: 1.27, w: 5.6, h: 1.6 }, right.map((s) => ({ text: `◇ ${s}` })), { sizes: [12, 11], lineSpacing: 1.3 }));

  els.push(
    text(
      { x: 0.43, y: 3.45, w: 4.6, h: 3.25 },
      [
        { text: `【会社名】${c.nameWide}`, bold: true },
        { text: '' },
        { text: '【本社】', bold: true },
        { text: `${c.headOffice.zip}　${c.headOffice.address}` },
        { text: `TEL：${c.headOffice.tel}　FAX：${c.headOffice.fax}` },
        { text: '' },
        { text: '【水戸営業所】', bold: true },
        { text: `${c.mitoOffice.zip}　${c.mitoOffice.address}` },
        ...c.mitoOffice.divisions.map((d) => ({ text: `${d.name}　TEL：${d.tel}` })),
      ],
      { sizes: [12, 11, 10.5], lineSpacing: 1.3 }
    )
  );

  // QRコード
  c.qrCodes.forEach((q, i) => {
    const x = 5.11 + i * 1.555;
    els.push({ kind: 'asset', asset: q.asset as AssetKey, box: { x, y: 2.95, w: 1.13, h: 1.13 } });
    els.push(text({ x, y: 4.1, w: 1.4, h: 0.5 }, q.label, { sizes: [9, 8], bold: true, lineSpacing: 1.2 }));
  });

  els.push({ kind: 'asset', asset: 'badges', box: { x: 6.5, y: 4.88, w: 3.24, h: 1.73 } });
  return els;
}

// ─── 全ページの組み立て ─────────────────────────────

/** 報告書全体のページを作る */
export function buildReportPages(
  report: Report,
  opts: { project?: Project | null; worker?: string | null } = {}
): Page[] {
  const project = opts.project ?? report.project ?? null;
  const chapters = (report.chapters || []) as ReportChapter[];
  const isSurvey = report.report_type === '調査報告書';
  const bodies: Element[][] = [];

  bodies.push(coverPage(report, project));

  const blocks: Block[] = [];
  for (const ch of chapters) {
    if (ch.key === 'cover' || ch.key === 'schedule' || ch.key === 'company') continue;
    if (!hasChapterContent(ch)) continue;
    if (ch.key === 'overview' && ch.photos.length <= 1) {
      bodies.push(overviewPage(ch));
      continue;
    }
    blocks.push(...chapterBlocks(ch));
  }

  // 半ページの項目は2つずつ1ページに。1ページ項目は単独で
  let pending: Block | null = null;
  const flush = () => {
    if (pending) {
      bodies.push(halfBlockElements(pending, 0));
      pending = null;
    }
  };
  for (const b of blocks) {
    if (b.full) {
      flush();
      bodies.push(fullBlockElements(b));
    } else if (pending) {
      bodies.push([...halfBlockElements(pending, 0), ...halfBlockElements(b, HALF_OFFSET)]);
      pending = null;
    } else {
      pending = b;
    }
  }
  flush();

  // 最後の2ページ（調査報告書は「工事日数・特記事項」と「会社案内」を常に出力）
  if (isSurvey) {
    bodies.push(schedulePage(report, chapters.find((c) => c.key === 'schedule'), opts.worker ?? null));
  }
  bodies.push(companyPage());

  return bodies.map((elements, i) => ({ elements: [...chrome(i + 1), ...elements] }));
}
