// MURATA システム定数

import type {
  ProjectStatus,
  ConstructionType,
  BuildingType,
  AudienceType,
  Weather,
  PhotoCategory,
  ReportType,
  ReportStatus,
  FindingSeverity,
  ReportStyle,
} from '@/types';

export const PROJECT_STATUSES: ProjectStatus[] = [
  '調査中',
  '見積中',
  '受注',
  '施工中',
  '完了',
];

export const CONSTRUCTION_TYPES: ConstructionType[] = [
  '雨漏り調査',
  '改修提案',
  '板金工事',
  '屋根工事',
  '外壁工事',
  '防水工事',
];

export const BUILDING_TYPES: BuildingType[] = ['住宅', '工場', '店舗'];

export const AUDIENCE_TYPES: AudienceType[] = ['一般施主向け', '建築関係者向け'];

export const WEATHERS: { value: Weather; emoji: string; label: string }[] = [
  { value: '晴', emoji: '☀️', label: '晴れ' },
  { value: '曇', emoji: '☁️', label: '曇り' },
  { value: '雨', emoji: '🌧️', label: '雨' },
  { value: '雪', emoji: '❄️', label: '雪' },
];

export const PHOTO_CATEGORIES: PhotoCategory[] = ['全体', '状況', '原因', '対策'];

export const STATUS_COLORS: Record<ProjectStatus, { bg: string; text: string }> = {
  '調査中': { bg: 'bg-amber-100', text: 'text-amber-800' },
  '見積中': { bg: 'bg-orange-100', text: 'text-orange-800' },
  '受注': { bg: 'bg-blue-100', text: 'text-blue-800' },
  '施工中': { bg: 'bg-emerald-100', text: 'text-emerald-800' },
  '完了': { bg: 'bg-gray-100', text: 'text-gray-600' },
};

export const CATEGORY_COLORS: Record<PhotoCategory, { bg: string; text: string }> = {
  '全体': { bg: 'bg-blue-100', text: 'text-blue-800' },
  '状況': { bg: 'bg-orange-100', text: 'text-orange-800' },
  '原因': { bg: 'bg-red-100', text: 'text-red-800' },
  '対策': { bg: 'bg-green-100', text: 'text-green-800' },
};

export const REPORT_TYPES: ReportType[] = ['調査報告書', '完了報告書'];

export const REPORT_STATUSES: ReportStatus[] = ['下書き', '確認中', '承認済み'];

export const SEVERITY_LEVELS: FindingSeverity[] = ['要補修', '経過観察', '問題なし'];

export const REPORT_STATUS_COLORS: Record<ReportStatus, { bg: string; text: string }> = {
  '下書き': { bg: 'bg-gray-100', text: 'text-gray-600' },
  '確認中': { bg: 'bg-amber-100', text: 'text-amber-800' },
  '承認済み': { bg: 'bg-emerald-100', text: 'text-emerald-800' },
};

export const SEVERITY_COLORS: Record<FindingSeverity, { bg: string; text: string }> = {
  '要補修': { bg: 'bg-red-100', text: 'text-red-800' },
  '経過観察': { bg: 'bg-amber-100', text: 'text-amber-800' },
  '問題なし': { bg: 'bg-green-100', text: 'text-green-800' },
};

export const REPORT_STYLES: { value: ReportStyle; label: string; description: string }[] = [
  { value: '茂様式', label: '茂様式', description: '赤ストライプフッター・Mロゴ付き' },
];

// ─── 章立てテンプレート ───────────────────────────
// 2026/9/29 打合せ議事録の方針:
//   ・報告書は「全体 → 対象部位 → 現況 → 原因 → 対策・提案」の顧客目線ストーリーを基本とする
//   ・調査報告書と完了報告書は基本的な考え方・様式を統一する
//   ・建物カテゴリー（住宅・工場・店舗）ごとにストーリー・提案内容を持たせる
// 章タイトルには番号を付けない（出力時に①②…を自動採番する）
// ※ カテゴリーごとの差分は仮案。MURATA様の社内すり合わせ結果で差し替える。
export interface ChapterTemplate {
  key: string;
  title: string;
}

const COVER: ChapterTemplate = { key: 'cover', title: '表紙' };
const COMPANY: ChapterTemplate = { key: 'company', title: '会社案内' };

// カテゴリーごとの「全体把握」章と、追加する配慮事項の章
const CATEGORY_VARIANTS: Record<
  BuildingType,
  { overview: string; consideration: ChapterTemplate }
> = {
  '住宅': {
    overview: '建物・周辺全体の把握',
    consideration: { key: 'consideration', title: '工事中の生活への影響・ご注意事項' },
  },
  '工場': {
    overview: '工場・敷地全体の把握',
    consideration: { key: 'consideration', title: '操業への影響・安全対策' },
  },
  '店舗': {
    overview: '店舗・建物全体の把握',
    consideration: { key: 'consideration', title: '営業への影響・工事時間帯' },
  },
};

function surveyTemplate(building: BuildingType, construction: ConstructionType | null): ChapterTemplate[] {
  const v = CATEGORY_VARIANTS[building];
  return [
    COVER,
    { key: 'overview', title: v.overview },
    { key: 'condition', title: '対象部位・不具合状況' },
    ...(construction === '雨漏り調査' ? [{ key: 'water_test', title: '散水調査' }] : []),
    { key: 'cause', title: '原因の特定' },
    { key: 'measures', title: '必要な対策' },
    { key: 'proposal', title: '修繕・工事提案' },
    v.consideration,
    { key: 'schedule', title: '工事日数・特記事項' },
    COMPANY,
  ];
}

function completionTemplate(building: BuildingType, construction: ConstructionType | null): ChapterTemplate[] {
  const v = CATEGORY_VARIANTS[building];
  return [
    COVER,
    { key: 'overview', title: v.overview },
    { key: 'before', title: '施工前の状況（対象部位・不具合）' },
    { key: 'cause', title: '原因と施工方針' },
    { key: 'work', title: '施工内容' },
    { key: 'after', title: '施工後の状況' },
    ...(construction === '雨漏り調査' ? [{ key: 'water_test', title: '散水による確認' }] : []),
    { key: 'warranty', title: '保証・今後のメンテナンス' },
    COMPANY,
  ];
}

export function getChapterTemplate(
  reportType: ReportType,
  buildingType?: BuildingType | null,
  constructionType?: ConstructionType | null
): ChapterTemplate[] {
  const building = buildingType ?? '住宅';
  const construction = constructionType ?? null;
  return reportType === '調査報告書'
    ? surveyTemplate(building, construction)
    : completionTemplate(building, construction);
}

// Navigation items
export const NAV_ITEMS = [
  { href: '/dashboard', label: 'ダッシュボード', icon: 'dashboard' },
  { href: '/projects', label: '案件一覧', icon: 'projects' },
  { href: '/daily-reports/new', label: '日報入力', icon: 'report' },
  { href: '/reports', label: '報告書', icon: 'reports' },
  { href: '/settings', label: '設定', icon: 'settings' },
] as const;
