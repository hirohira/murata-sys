/**
 * 現場ID生成ロジック
 * 形式: MRT-{YYYYMMDD}{連番2桁}_{顧客名}_{現場名}_{工事種別}_{着工年月}
 * 例: MRT-2026100101_UDトラックス_水戸工場_雨漏り調査_202611
 */

/**
 * Sanitize a string for use in project ID:
 * - Remove special characters except katakana/kanji/alphanumeric
 * - Truncate to maxLen characters
 */
function sanitizeForId(str: string, maxLen: number = 8): string {
  // Remove whitespace and special characters, keep Japanese and alphanumeric
  const cleaned = str.replace(/[\s　・（）()【】「」\/\\,，.。、!！?？]/g, '');
  return cleaned.slice(0, maxLen);
}

/**
 * Format a date as YYYYMMDD
 */
function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/**
 * Format a date as YYYYMM
 */
function formatYearMonth(dateStr: string): string {
  // Input: "2026-11" or "2026-11-01"
  return dateStr.replace(/-/g, '').slice(0, 6);
}

/**
 * Generate a project ID
 * @param params - Project details
 * @param sequenceNumber - The sequence number for the day (1-based)
 * @returns Generated project ID string
 */
export function generateProjectId(params: {
  customerName: string;
  siteName: string;
  constructionType: string;
  startDate: string; // YYYY-MM format
  sequenceNumber: number;
  createdDate?: Date;
}): string {
  const {
    customerName,
    siteName,
    constructionType,
    startDate,
    sequenceNumber,
    createdDate = new Date(),
  } = params;

  const datePart = formatDate(createdDate);
  const seqPart = String(sequenceNumber).padStart(2, '0');
  const customerPart = sanitizeForId(customerName);
  const sitePart = sanitizeForId(siteName);
  const typePart = sanitizeForId(constructionType);
  const startPart = formatYearMonth(startDate);

  return `MRT-${datePart}${seqPart}_${customerPart}_${sitePart}_${typePart}_${startPart}`;
}

/**
 * Preview a project ID (for display in the form before saving)
 */
export function previewProjectId(params: {
  customerName: string;
  siteName: string;
  constructionType: string;
  startDate: string;
}): string {
  return generateProjectId({
    ...params,
    sequenceNumber: 1,
    createdDate: new Date(),
  });
}
