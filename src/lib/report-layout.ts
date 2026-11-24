// 報告書の様式に応じてページを組み立てる（プレビューと PowerPoint 出力で共通）
import type { Project, Report } from '@/types';
import { buildReportPages, SIZE_4x3, type Page, type SlideSize } from '@/lib/report-pages';
import { buildSurveyPages, SIZE_A4 } from '@/lib/report-pages-survey';

export function isSurveyStyle(report: Pick<Report, 'meta'>): boolean {
  return report.meta?.report_style === '調査報告書様式';
}

export function buildPages(
  report: Report,
  opts: { project?: Project | null; worker?: string | null } = {}
): { size: SlideSize; pages: Page[] } {
  if (isSurveyStyle(report)) return { size: SIZE_A4, pages: buildSurveyPages(report, opts) };
  return { size: SIZE_4x3, pages: buildReportPages(report, opts) };
}
