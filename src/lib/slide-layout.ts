/**
 * 章スライド（茂様式・4:3）のレイアウト計算
 * プレビュー（ReportSlidePreview）とPowerPoint出力（report-pptx）で共通に使う。
 * 単位はすべてインチ（スライドは 10 × 7.5 インチ）。
 *
 * ・写真3枚までは横1列に並べる。4〜6枚は3列×2段。7枚目以降は省略（枚数を表示）
 * ・施工前/施工後タグがある場合は左右に並べて比較表示
 * ・説明文は写真の下の残りスペースに収まるよう文字サイズを自動調整し、
 *   最小サイズでも収まらない場合は末尾を「…」で省略する
 */
import type { ChapterPhoto } from '@/types';

export const SLIDE_W = 10;
export const SLIDE_H = 7.5;

const MARGIN_X = 0.5;
const CONTENT_W = SLIDE_W - MARGIN_X * 2; // 9.0
const CONTENT_TOP = 0.8; // 見出しの赤線の下
const CONTENT_BOTTOM = 7.0; // フッターの赤線（7.15）の上
const GAP = 0.2;
const CAPTION_H = 0.24;
const MAX_PHOTOS = 6;

export const TITLE_BOX = { x: 0, y: 0.05, w: SLIDE_W, h: 0.55 };
export const TITLE_RULE = { x: MARGIN_X, y: 0.6, w: CONTENT_W, h: 0.03 };

export const DESC_FONT_SIZES = [12, 11, 10, 9, 8];
export const DESC_LINE_SPACING = 1.5;
export const CAPTION_FONT = 8;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PhotoSlot {
  photo: ChapterPhoto;
  box: Box;
  caption?: { text: string; box: Box };
}

export interface ChapterSlideLayout {
  photos: PhotoSlot[];
  labels: { text: string; color: string; box: Box }[];
  hiddenCount: number;
  description?: { text: string; box: Box; fontSize: number; truncated: boolean };
}

/** 文字の表示幅（全角=1、半角=0.55）の概算 */
function charWidth(ch: string): number {
  return /[\u0000-ÿ｡-ﾟ]/.test(ch) ? 0.55 : 1;
}

/** 指定幅（インチ）・文字サイズ（pt）で折り返したときの行数 */
function countLines(text: string, widthIn: number, fontPt: number): number {
  const lineUnits = (widthIn * 72) / fontPt;
  let lines = 0;
  for (const para of text.split('\n')) {
    let used = 0;
    let paraLines = 1;
    for (const ch of para) {
      const w = charWidth(ch);
      if (used + w > lineUnits) {
        paraLines += 1;
        used = w;
      } else {
        used += w;
      }
    }
    lines += paraLines;
  }
  return lines;
}

function linesThatFit(heightIn: number, fontPt: number): number {
  // 描画環境の差を見込んで 92% までに収める
  return Math.floor((heightIn * 72 * 0.92) / (fontPt * DESC_LINE_SPACING));
}

/** 説明文を枠に収める（文字サイズを下げ、それでも溢れれば末尾を省略） */
export function fitDescription(
  text: string,
  box: Box
): { text: string; fontSize: number; truncated: boolean } {
  const body = text.trim();
  for (const size of DESC_FONT_SIZES) {
    if (countLines(body, box.w, size) <= linesThatFit(box.h, size)) {
      return { text: body, fontSize: size, truncated: false };
    }
  }
  const size = DESC_FONT_SIZES[DESC_FONT_SIZES.length - 1];
  const maxLines = Math.max(1, linesThatFit(box.h, size));
  let lo = 0;
  let hi = body.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (countLines(body.slice(0, mid) + '…', box.w, size) <= maxLines) lo = mid;
    else hi = mid - 1;
  }
  return { text: body.slice(0, lo).trimEnd() + '…', fontSize: size, truncated: true };
}

function photoSize(cols: number, maxH: number): { w: number; h: number } {
  const w = Math.min((CONTENT_W - GAP * (cols - 1)) / cols, (maxH * 4) / 3);
  return { w, h: (w * 3) / 4 };
}

function regularLayout(photos: ChapterPhoto[]): { slots: PhotoSlot[]; bottom: number } {
  const shown = photos.slice(0, MAX_PHOTOS);
  const rows = shown.length <= 3 ? 1 : 2;
  const cols = rows === 1 ? shown.length : 3;
  // 1段なら最大高さ3.3インチ、2段なら1段あたり1.8インチ
  const { w, h } = photoSize(cols, rows === 1 ? 3.3 : 1.8);
  const hasCaption = shown.some((p) => p.caption?.trim());
  const rowH = h + (hasCaption ? CAPTION_H : 0);

  const slots: PhotoSlot[] = shown.map((photo, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const inRow = Math.min(cols, shown.length - row * cols);
    const rowW = inRow * w + (inRow - 1) * GAP;
    const x = MARGIN_X + (CONTENT_W - rowW) / 2 + col * (w + GAP);
    const y = CONTENT_TOP + row * (rowH + GAP / 2);
    const caption = photo.caption?.trim();
    return {
      photo,
      box: { x, y, w, h },
      caption: caption ? { text: caption, box: { x, y: y + h + 0.02, w, h: CAPTION_H - 0.02 } } : undefined,
    };
  });

  return { slots, bottom: CONTENT_TOP + rows * rowH + (rows - 1) * (GAP / 2) };
}

function beforeAfterLayout(photos: ChapterPhoto[]): {
  slots: PhotoSlot[];
  labels: ChapterSlideLayout['labels'];
  bottom: number;
} {
  const before = photos.filter((p) => p.tag === 'before');
  const after = photos.filter((p) => p.tag === 'after');
  const pairs = Math.min(Math.max(before.length, after.length, 1), 3);
  const labelH = 0.28;
  const halfW = (CONTENT_W - GAP) / 2;
  const areaH = 3.9 - labelH;
  const h = Math.min(3.3, (areaH - (GAP / 2) * (pairs - 1)) / pairs, (halfW * 3) / 4);
  const w = (h * 4) / 3;
  const top = CONTENT_TOP + labelH;

  const colX = (side: 0 | 1) => MARGIN_X + side * (halfW + GAP) + (halfW - w) / 2;
  const labels = [
    { text: '施工前', color: 'E65100', box: { x: MARGIN_X, y: CONTENT_TOP, w: halfW, h: labelH } },
    { text: '施工後', color: '2E7D32', box: { x: MARGIN_X + halfW + GAP, y: CONTENT_TOP, w: halfW, h: labelH } },
  ];

  const slots: PhotoSlot[] = [];
  for (let i = 0; i < pairs; i++) {
    const y = top + i * (h + GAP / 2);
    if (before[i]) slots.push({ photo: before[i], box: { x: colX(0), y, w, h } });
    if (after[i]) slots.push({ photo: after[i], box: { x: colX(1), y, w, h } });
  }
  return { slots, labels, bottom: top + pairs * h + (pairs - 1) * (GAP / 2) };
}

export function layoutChapterSlide(photos: ChapterPhoto[], description: string): ChapterSlideLayout {
  const list = photos || [];
  const hasBeforeAfter = list.some((p) => p.tag === 'before' || p.tag === 'after');

  let slots: PhotoSlot[] = [];
  let labels: ChapterSlideLayout['labels'] = [];
  let bottom = CONTENT_TOP;
  let hiddenCount = 0;

  if (list.length > 0) {
    if (hasBeforeAfter) {
      const r = beforeAfterLayout(list);
      slots = r.slots;
      labels = r.labels;
      bottom = r.bottom;
      hiddenCount = list.length - slots.length;
    } else {
      const r = regularLayout(list);
      slots = r.slots;
      bottom = r.bottom;
      hiddenCount = Math.max(0, list.length - MAX_PHOTOS);
    }
  }

  let desc: ChapterSlideLayout['description'];
  if (description?.trim()) {
    const y = list.length > 0 ? bottom + 0.2 : CONTENT_TOP;
    const box = { x: MARGIN_X, y, w: CONTENT_W, h: Math.max(0.4, CONTENT_BOTTOM - y) };
    desc = { ...fitDescription(description, box), box };
  }

  return { photos: slots, labels, hiddenCount, description: desc };
}
