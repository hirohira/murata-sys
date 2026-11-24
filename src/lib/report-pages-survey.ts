/**
 * 調査報告書様式（MURATA様の実際の調査報告書 2026年版に合わせたレイアウト）
 *
 * - 用紙は A4 横（10.83 × 7.5 インチ）
 * - 各ページ：上に「○○について」の見出し（中央）と赤線、下に赤線とロゴ・ページ番号
 * - 写真は章ごとの枚数でレイアウトを変える（1〜6枚。7枚以上は6枚ずつページを分ける）
 *     1枚 … 中央に大きく1枚
 *     2枚 … 大きく2枚を横に
 *     3枚 … 横に3枚（遠景→近景→アップ）
 *     4枚 … 一続きなら「上に3枚＋右下に1枚、左下に説明」、別々なら2枚×2段
 *     5枚 … 上に3枚＋下に2枚
 *     6枚 … 3枚×2段（段ごとにコメント）
 * - 同じ group 番号の写真（一続きで撮った写真）の間には「→」を入れる
 * - 写真のコメントは group ごとにまとめ、その group の最後の写真がある段の下に出す
 */
import type { ChapterPhoto, Project, Report, ReportChapter } from '@/types';
import { stripChapterNumber, hasChapterContent } from '@/lib/chapter-numbering';
import {
  companyPage,
  formatJpDate,
  photoBadge,
  schedulePage,
  text,
  type Box,
  type Element,
  type Page,
  type Paragraph,
  type SlideSize,
} from '@/lib/report-pages';

export const SIZE_A4: SlideSize = { w: 10.83, h: 7.5 };

const W = SIZE_A4.w;
const L = 0.3;
const CW = W - L * 2;
const RED = 'FF0000';
const INK = '222222';

export const SURVEY_INTRO_DEFAULT = '雨漏りについて御報告をさせて頂きます。';
export const SURVEY_CLOSING_DEFAULT = '報告書は以上とさせて頂きます。';

// ─── 共通の枠 ─────────────────────────────

function chrome(pageNumber: number, title?: string): Element[] {
  const els: Element[] = [
    { kind: 'line', box: { x: L, y: 7.22, w: CW, h: 0 }, color: RED, widthPt: 2.25 },
    { kind: 'asset', asset: 'logoMurata', box: { x: 0.35, y: 6.8, w: 1.54, h: 0.33 } },
    { kind: 'asset', asset: 'logoCert', box: { x: 1.93, y: 6.8, w: 0.43, h: 0.32 } },
    { kind: 'asset', asset: 'logoAmamoriDr', box: { x: W - 0.35 - 0.39 - 1.42, y: 6.79, w: 1.38, h: 0.34 } },
    { kind: 'asset', asset: 'mascot', box: { x: W - 0.35 - 0.39, y: 6.66, w: 0.39, h: 0.48 } },
    text({ x: W / 2 - 0.6, y: 6.95, w: 1.2, h: 0.24 }, `${pageNumber}P`, {
      sizes: [9],
      color: '888888',
      align: 'center',
      valign: 'middle',
    }),
  ];
  if (title) {
    els.push(
      text({ x: L, y: 0.2, w: CW, h: 0.44 }, title, { sizes: [16, 15, 14, 13, 12], bold: true, align: 'center', valign: 'bottom' }),
      { kind: 'line', box: { x: L, y: 0.7, w: CW, h: 0 }, color: RED, widthPt: 2.25 }
    );
  }
  return els;
}

// ─── 写真の配置 ─────────────────────────────

interface Item {
  photo: ChapterPhoto;
  group: number; // ページ内の group の通し番号
}

interface Group {
  photos: ChapterPhoto[];
  caption: string;
}

/** 章の写真を group ごとにまとめる（group 番号がなければ章全体で1つ） */
export function chapterGroups(chapter: ReportChapter): Group[] {
  const photos = [...(chapter.photos || [])].sort((a, b) => a.sort_order - b.sort_order);
  const groups: Group[] = [];
  let lastKey: number | undefined | null = null;
  for (const p of photos) {
    const key = typeof p.group === 'number' ? p.group : undefined;
    if (groups.length === 0 || key !== lastKey) groups.push({ photos: [], caption: '' });
    groups[groups.length - 1].photos.push(p);
    lastKey = key;
  }
  for (const g of groups) {
    const seen = new Set<string>();
    g.caption = g.photos
      .map((p) => (p.caption || '').trim())
      .filter((c) => c && !seen.has(c) && seen.add(c))
      .join('\n');
  }
  return groups;
}

/** 7枚以上は6枚以内のページに分ける。group はできるだけ分けない */
function paginate(groups: Group[]): Group[][] {
  const pieces: Group[] = [];
  for (const g of groups) {
    if (g.photos.length <= 6) {
      pieces.push(g);
      continue;
    }
    for (let i = 0; i < g.photos.length; i += 6) {
      const last = i + 6 >= g.photos.length;
      pieces.push({ photos: g.photos.slice(i, i + 6), caption: last ? g.caption : '' });
    }
  }
  const pages: Group[][] = [];
  let cur: Group[] = [];
  let count = 0;
  for (const g of pieces) {
    if (count + g.photos.length > 6 && cur.length) {
      pages.push(cur);
      cur = [];
      count = 0;
    }
    cur.push(g);
    count += g.photos.length;
  }
  if (cur.length || pages.length === 0) pages.push(cur);
  return pages;
}

function rowBoxes(n: number, y: number, w: number, h: number, gap: number): Box[] {
  const total = n * w + (n - 1) * gap;
  const start = (W - total) / 2;
  return Array.from({ length: n }, (_, i) => ({ x: start + i * (w + gap), y, w, h }));
}

function photoEl(photo: ChapterPhoto, box: Box): Element {
  return { kind: 'photo', photo, box, badge: photoBadge(photo) };
}

function hArrow(a: Box, b: Box): Element {
  const y = a.y + a.h / 2;
  return { kind: 'arrow', from: { x: a.x + a.w + 0.05, y }, to: { x: b.x - 0.05, y }, color: INK, widthPt: 1.5 };
}

function vArrow(a: Box, b: Box): Element {
  const x = a.x + a.w / 2;
  return { kind: 'arrow', from: { x, y: a.y + a.h + 0.05 }, to: { x, y: b.y - 0.05 }, color: INK, widthPt: 1.5 };
}

const CAPTION_SIZES = [13, 12, 11, 10, 9];

function captionText(box: Box, lines: string[], align: 'left' | 'center' = 'center'): Element[] {
  const paragraphs: Paragraph[] = lines
    .flatMap((t) => t.split('\n'))
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => ({ text: t }));
  if (paragraphs.length === 0) return [];
  return [text(box, paragraphs, { sizes: CAPTION_SIZES, lineSpacing: 1.35, align, valign: 'top' })];
}

/** 段（row）ごとのコメント：group の最後の写真がある段に、その group のコメントを出す */
function rowCaptions(items: Item[], groups: Group[], rowOf: (i: number) => number, rows: number): string[][] {
  const out: string[][] = Array.from({ length: rows }, () => []);
  groups.forEach((g, gi) => {
    if (!g.caption) return;
    let lastIdx = -1;
    items.forEach((it, i) => {
      if (it.group === gi) lastIdx = i;
    });
    if (lastIdx >= 0) out[rowOf(lastIdx)].push(g.caption);
  });
  return out;
}

/** 1ページ分の写真とコメントを並べる。tail は章の説明文（最後のコメント欄に足す） */
function layoutPhotos(groups: Group[], tail: string): Element[] {
  const items: Item[] = groups.flatMap((g, gi) => g.photos.map((photo) => ({ photo, group: gi })));
  const n = items.length;
  const els: Element[] = [];
  const allText = [...groups.map((g) => g.caption).filter(Boolean), ...(tail ? [tail] : [])];
  const sameGroup = (a: number, b: number) => items[a] && items[b] && items[a].group === items[b].group;

  // 一列に並べるときの矢印
  const rowArrows = (boxes: Box[], startIdx: number) => {
    for (let i = 0; i + 1 < boxes.length; i++) {
      if (sameGroup(startIdx + i, startIdx + i + 1)) els.push(hArrow(boxes[i], boxes[i + 1]));
    }
  };

  if (n === 0) {
    els.push(...captionText({ x: 0.8, y: 1.0, w: W - 1.6, h: 5.6 }, allText, 'left'));
    return els;
  }

  if (n === 1) {
    const box = { x: (W - 6.2) / 2, y: 0.85, w: 6.2, h: 4.65 };
    els.push(photoEl(items[0].photo, box));
    els.push(...captionText({ x: 0.8, y: 5.62, w: W - 1.6, h: 1.08 }, allText));
    return els;
  }

  if (n === 2) {
    const boxes = rowBoxes(2, 0.95, 4.7, 3.525, 0.55);
    items.forEach((it, i) => els.push(photoEl(it.photo, boxes[i])));
    rowArrows(boxes, 0);
    els.push(...captionText({ x: 0.8, y: 4.62, w: W - 1.6, h: 2.05 }, allText));
    return els;
  }

  if (n === 3) {
    const boxes = rowBoxes(3, 0.9, 3.2, 2.4, 0.3);
    items.forEach((it, i) => els.push(photoEl(it.photo, boxes[i])));
    rowArrows(boxes, 0);
    els.push(...captionText({ x: 0.6, y: 3.45, w: W - 1.2, h: 3.25 }, allText));
    return els;
  }

  if (n === 4 && groups.length === 1) {
    // 上に3枚、3枚目の下にアップを1枚、左下に説明
    const top = rowBoxes(3, 0.9, 3.2, 2.4, 0.3);
    const bottom: Box = { x: top[2].x, y: 3.75, w: 3.2, h: 2.4 };
    items.slice(0, 3).forEach((it, i) => els.push(photoEl(it.photo, top[i])));
    els.push(photoEl(items[3].photo, bottom));
    rowArrows(top, 0);
    els.push(vArrow(top[2], bottom));
    els.push(...captionText({ x: 0.55, y: 3.75, w: bottom.x - 0.85, h: 2.85 }, allText, 'left'));
    return els;
  }

  // 2段：4枚（2＋2）・5枚（3＋2 / 2＋3）・6枚（3＋3）
  // 段の切れ目は、できるだけ写真の組の切れ目に合わせる
  const bounds = new Set<number>();
  let acc = 0;
  for (const g of groups) bounds.add((acc += g.photos.length));
  const options = [3, 2, 1].filter((f) => n - f >= 1 && n - f <= 3);
  const firstRow = options.find((f) => bounds.has(f)) ?? (n === 4 ? 2 : 3);
  const rows = [items.slice(0, firstRow), items.slice(firstRow)];
  const wide = rows.every((r) => r.length <= 2);
  const w = wide ? 3.3 : 3.0;
  const h = 2.25;
  const gap = wide ? 0.55 : 0.35;
  const ys = [0.85, 3.8];
  const caps = rowCaptions(items, groups, (i) => (i < firstRow ? 0 : 1), 2);
  if (tail) caps[1].push(tail);
  rows.forEach((row, r) => {
    const boxes = rowBoxes(row.length, ys[r], w, h, gap);
    row.forEach((it, i) => els.push(photoEl(it.photo, boxes[i])));
    rowArrows(boxes, r === 0 ? 0 : firstRow);
  });
  // 上の段にコメントがあれば、その下に入れて赤線で区切る（実物の6枚ページと同じ）
  if (caps[0].length) {
    els.push(...captionText({ x: 0.6, y: 3.15, w: W - 1.2, h: 0.5 }, caps[0]));
    els.push({ kind: 'line', box: { x: L, y: 3.7, w: CW, h: 0 }, color: RED, widthPt: 2.25 });
  }
  els.push(...captionText({ x: 0.6, y: 6.1, w: W - 1.2, h: 0.62 }, caps[1]));
  return els;
}

// ─── 表紙・はじめ・おわり ─────────────────────────────

function coverPage(report: Report, project?: Project | null): Element[] {
  const meta = report.meta ?? {};
  const addressee = (meta.addressee || (project ? `${project.customer_name}　様` : '')).trim();
  const projectName = meta.construction_name?.trim() || report.title;
  const info: Paragraph[] = [];
  if (project?.address) info.push({ text: `現場住所：${project.address}` });
  const dates: Paragraph[] = [];
  if (meta.survey_date) dates.push({ text: `調査日：${formatJpDate(meta.survey_date)}` });
  dates.push({ text: `作成日：${formatJpDate(report.created_at)}` });

  return [
    text({ x: 1, y: 0.9, w: W - 2, h: 0.8 }, report.report_type, { sizes: [28], bold: true, align: 'center', valign: 'middle' }),
    ...(addressee
      ? [text({ x: 1, y: 2.05, w: W - 2, h: 0.5 }, /(様|様宛|御中|殿)$/.test(addressee) ? addressee : `${addressee}　様`, { sizes: [16, 15, 14], align: 'center', valign: 'middle' })]
      : []),
    text({ x: 0.8, y: 2.95, w: W - 1.6, h: 0.6 }, `工事名：${projectName}`, { sizes: [16, 15, 14, 13, 12], align: 'center', valign: 'middle' }),
    ...(info.length ? [text({ x: 1, y: 4.0, w: W - 2, h: 0.4 }, info, { sizes: [12, 11, 10], align: 'center', valign: 'middle' })] : []),
    text({ x: 1, y: 4.55, w: W - 2, h: 0.7 }, dates, { sizes: [12, 11], align: 'center', valign: 'top' }),
  ];
}

/** 建物の全景写真＋一文（はじめ・おわりのページ） */
function photoWithLine(photo: ChapterPhoto | undefined, line: string): Element[] {
  return [
    ...(photo ? [photoEl(photo, { x: (W - 5.6) / 2, y: 0.55, w: 5.6, h: 4.2 })] : []),
    text({ x: 0.8, y: photo ? 5.0 : 2.5, w: W - 1.6, h: 1.5 }, line, { sizes: [14, 13, 12, 11], align: 'center', valign: 'top' }),
  ];
}

// ─── 全ページの組み立て ─────────────────────────────

const SKIP = new Set(['cover', 'schedule', 'company', 'overview', 'closing']);

function shift(els: Element[], dx: number): Element[] {
  return els.map((el) => {
    if (el.kind === 'arrow') {
      return { ...el, from: { ...el.from, x: el.from.x + dx }, to: { ...el.to, x: el.to.x + dx } };
    }
    return { ...el, box: { ...el.box, x: el.box.x + dx } } as Element;
  });
}

export function buildSurveyPages(
  report: Report,
  opts: { project?: Project | null; worker?: string | null } = {}
): Page[] {
  const project = opts.project ?? report.project ?? null;
  const chapters = (report.chapters || []) as ReportChapter[];
  const isSurvey = report.report_type === '調査報告書';
  const bodies: { title?: string; els: Element[] }[] = [];

  bodies.push({ els: coverPage(report, project) });

  const overview = chapters.find((c) => c.key === 'overview');
  const closing = chapters.find((c) => c.key === 'closing');
  const overviewPhoto = overview?.photos?.[0];
  if (overview && hasChapterContent(overview)) {
    bodies.push({ els: photoWithLine(overviewPhoto, overview.description?.trim() || SURVEY_INTRO_DEFAULT) });
    // 全景が2枚以上あるときは、残りを通常の写真ページに
    if ((overview.photos?.length ?? 0) > 1) {
      const rest = { ...overview, photos: overview.photos.slice(1), description: '' };
      for (const g of paginate(chapterGroups(rest))) {
        bodies.push({ title: stripChapterNumber(overview.title || '全景'), els: layoutPhotos(g, '') });
      }
    }
  }

  for (const ch of chapters) {
    if (SKIP.has(ch.key)) continue;
    if (!hasChapterContent(ch)) continue;
    const title = stripChapterNumber(ch.title || '');
    const pages = paginate(chapterGroups(ch));
    pages.forEach((groups, i) => {
      const last = i === pages.length - 1;
      bodies.push({ title, els: layoutPhotos(groups, last ? (ch.description || '').trim() : '') });
    });
  }

  if (overviewPhoto || closing) {
    bodies.push({
      els: photoWithLine(closing?.photos?.[0] ?? overviewPhoto, closing?.description?.trim() || SURVEY_CLOSING_DEFAULT),
    });
  }

  const dx = (W - 10) / 2;
  if (isSurvey) {
    bodies.push({ els: shift(schedulePage(report, chapters.find((c) => c.key === 'schedule'), opts.worker ?? null), dx) });
  }
  bodies.push({ els: shift(companyPage(), dx) });

  return bodies.map((b, i) => ({ elements: [...chrome(i + 1, b.title), ...b.els] }));
}
