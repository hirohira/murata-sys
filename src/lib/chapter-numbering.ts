// 報告書の章を出力用に整える（空の章を除外し、①②…を自動採番する）
import type { ReportChapter } from '@/types';

const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';

// 番号を付けない章（表紙・会社案内）
const UNNUMBERED_KEYS = new Set(['cover', 'company']);

/** 先頭の丸数字を取り除く（以前のテンプレートで保存された「①建物全体…」等に対応） */
export function stripChapterNumber(title: string): string {
  return title.replace(/^[①-⑳]\s*/, '');
}

export function hasChapterContent(ch: ReportChapter): boolean {
  return Boolean(ch.description?.trim()) || (ch.photos?.length ?? 0) > 0;
}

export interface OutputChapter {
  chapter: ReportChapter;
  displayTitle: string;
}

/**
 * 出力対象の章（表紙以外で、写真か説明文がある章）を順に並べ、
 * 番号付きの表示タイトルを付けて返す。
 */
export function getOutputChapters(chapters: ReportChapter[] | null | undefined): OutputChapter[] {
  let n = 0;
  return (chapters || [])
    .filter((ch) => ch.key !== 'cover' && hasChapterContent(ch))
    .map((ch) => {
      const base = stripChapterNumber(ch.title || '');
      if (UNNUMBERED_KEYS.has(ch.key)) return { chapter: ch, displayTitle: base };
      n += 1;
      const mark = n <= CIRCLED.length ? CIRCLED[n - 1] : `${n}.`;
      return { chapter: ch, displayTitle: `${mark}${base}` };
    });
}
