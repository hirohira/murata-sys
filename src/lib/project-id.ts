/**
 * 現場ID・現場フォルダ名・ファイル名のルール
 * （「MURATA 現場データ保存フォルダ 運用テンプレート」準拠）
 *
 * 現場ID       : {登録年}-{年内連番3桁}                 例: 2026-001
 * 現場フォルダ名 : 【現場ID】_顧客名_現場名_工事種別_着工年月  例: 2026-001_〇〇株式会社_水戸工場_屋根工事_202610
 * ファイル名    : 日付_現場ID_内容_作業者               例: 20261005_2026-001_屋根施工中_東面.jpg
 */

export const PROJECT_ID_PATTERN = /^(\d{4})-(\d{3,})$/;

/** 日本時間での日付パーツ */
export function jstParts(date: Date = new Date()) {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return {
    year: jst.getUTCFullYear(),
    month: String(jst.getUTCMonth() + 1).padStart(2, '0'),
    day: String(jst.getUTCDate()).padStart(2, '0'),
  };
}

export function formatProjectId(year: number, sequence: number): string {
  return `${year}-${String(sequence).padStart(3, '0')}`;
}

/** 既存の現場ID一覧から、指定年の次の現場IDを求める */
export function nextProjectId(existingIds: string[], year: number): string {
  let max = 0;
  for (const id of existingIds) {
    const m = PROJECT_ID_PATTERN.exec(id);
    if (m && Number(m[1]) === year) max = Math.max(max, Number(m[2]));
  }
  return formatProjectId(year, max + 1);
}

/** フォルダ名・ファイル名に使えない文字を除く */
export function sanitizeForName(str: string, maxLen = 40): string {
  return str
    .replace(/[\\/:*?"<>|\r\n\t]/g, '')
    .replace(/[\s　]+/g, '')
    .slice(0, maxLen);
}

/** 着工年月（YYYYMM）。着工日が未定なら登録年月 */
function startYearMonth(startDate: string | null | undefined, fallback: Date): string {
  if (startDate) return startDate.replace(/-/g, '').slice(0, 6);
  const { year, month } = jstParts(fallback);
  return `${year}${month}`;
}

export function buildSiteFolderName(project: {
  project_id: string;
  customer_name: string;
  site_name: string;
  construction_type: string;
  start_date?: string | null;
  created_at?: string | null;
}): string {
  const created = project.created_at ? new Date(project.created_at) : new Date();
  return [
    project.project_id,
    sanitizeForName(project.customer_name),
    sanitizeForName(project.site_name),
    sanitizeForName(project.construction_type),
    startYearMonth(project.start_date, created),
  ].join('_');
}

/** 案件登録フォームでのフォルダ名プレビュー（連番は登録時に確定） */
export function previewSiteFolderName(params: {
  customerName: string;
  siteName: string;
  constructionType: string;
  startDate: string;
}): string {
  const { year } = jstParts();
  return buildSiteFolderName({
    project_id: `${year}-XXX`,
    customer_name: params.customerName || '顧客名',
    site_name: params.siteName || '現場名',
    construction_type: params.constructionType,
    start_date: params.startDate || null,
  });
}

/** ファイル名: 日付_現場ID_内容_作業者.拡張子 */
export function buildFileName(params: {
  date?: Date;
  projectId: string;
  content: string;
  worker?: string | null;
  ext: string;
}): string {
  const { year, month, day } = jstParts(params.date);
  const parts = [`${year}${month}${day}`, params.projectId, sanitizeForName(params.content, 60)];
  if (params.worker) parts.push(sanitizeForName(params.worker, 20));
  return `${parts.join('_')}.${params.ext}`;
}

/**
 * ルールどおりのファイル名から「内容」部分を取り出す（写真キャプションの初期値に使う）
 * 例: 20261005_2026-001_屋根施工中_東面.jpg → 屋根施工中_東面
 */
export function contentFromFileName(name: string): string {
  const m = /^\d{8}_\d{4}-\d{3,}_(.+)\.[A-Za-z0-9]+$/.exec(name);
  return m ? m[1] : '';
}
