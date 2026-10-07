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
// 調査報告書は実物（グラスセゾン）に合わせ、最後の2ページ「工事日数・特記事項」「会社案内」を常に出力する。
export interface ChapterTemplate {
  key: string;
  title: string;
}

const COVER: ChapterTemplate = { key: 'cover', title: '表紙' };
const COMPANY: ChapterTemplate = { key: 'company', title: '会社案内' };

// カテゴリーごとの「全体把握」章のタイトル
const OVERVIEW_TITLE: Record<BuildingType, string> = {
  '住宅': '建物・周辺全体の把握',
  '工場': '工場・敷地全体の把握',
  '店舗': '店舗・建物全体の把握',
};

// 調査報告書の最後の2ページ（常に出力する）
const SCHEDULE: ChapterTemplate = { key: 'schedule', title: '工事日数・特記事項' };

function surveyTemplate(building: BuildingType, construction: ConstructionType | null): ChapterTemplate[] {
  return [
    COVER,
    { key: 'overview', title: OVERVIEW_TITLE[building] },
    { key: 'condition', title: '対象部位・不具合状況' },
    ...(construction === '雨漏り調査' ? [{ key: 'water_test', title: '散水調査' }] : []),
    { key: 'cause', title: '原因の特定' },
    { key: 'measures', title: '必要な対策' },
    { key: 'proposal', title: '修繕・工事提案' },
    SCHEDULE,
    COMPANY,
  ];
}

function completionTemplate(building: BuildingType, construction: ConstructionType | null): ChapterTemplate[] {
  return [
    COVER,
    { key: 'overview', title: OVERVIEW_TITLE[building] },
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

// ─── 報告書の固定ページの内容（実物の調査報告書より） ───
export const MURATA_COMPANY = {
  name: '株式会社MURATA',
  nameWide: '株式会社ＭＵＲＡＴＡ',
  slogan: '従業員の安心と安全と健康を第一に考え地域社会に貢献する企業',
  headOffice: { zip: '〒310-0841', address: '茨城県水戸市酒門町4242番地', tel: '029-246-5557', fax: '029-246-5558' },
  contractorLine: '会社名：株式会社MURATA　住所：茨城県水戸市酒門町4242　TEL：029-246-5557',
  mitoOffice: {
    zip: '〒310-0851',
    address: '茨城県水戸市千波町2498-1',
    divisions: [
      { name: '雨漏りDr.事業部', tel: '029-305-6008' },
      { name: 'リフォームDr.事業部', tel: '029-305-6004' },
    ],
  },
  services: [
    '雨漏り修理',
    '暑さ対策リフレクティックス遮熱工事',
    '屋根工事・外壁工事',
    '無人航空機ドローンによる雨漏り調査',
    '防水・シーリング工事',
    'ロープアクセス工事',
    'トータルリフォーム工事',
    '健康経営優良法人',
    '太陽光発電システム設置工事',
    '屋根、外壁塗装工事',
    'スチールアーチ（車庫、倉庫）',
  ],
  qrCodes: [
    { asset: 'qrAmamoriDr', label: '雨漏りDr.茨城\nHP' },
    { asset: 'qrFactory', label: '工場・倉庫\n改修工事 HP' },
    { asset: 'qrSteelArch', label: 'スチールアーチ\nHP' },
  ],
} as const;

/** 特記事項の定型文（red: true は赤字） */
export const STANDARD_SPECIAL_NOTES: { text: string; red?: boolean }[] = [
  { text: '電気、水道が必要な場合は無償ご貸与頂けますようお願い申し上げます。' },
  { text: 'ほこりや音が出る作業な為、必要であれば近隣の方に工事のご連絡をお願い致します。' },
  { text: '作業員のトイレは御社を貸して頂ければ幸いですが、状況により近隣コンビニなどを使用致します。' },
  { text: '工事決定の際は請負契約書を結ばさせて頂きます。' },
  { text: '調査報告書を基に他社による施工に関して、責任は負いかねます。ご了承ください。' },
  { text: 'この報告書はなくさず保管をお願い致します。' },
  { text: '雨漏りの原因が工事ヵ所と異なる場合や結露、自然災害などは保証対象外とさせて頂きます。ご了承ください。', red: true },
  {
    text: '現状、経年劣化や納まりなどの不具合により他の部分から雨水が浸入し、同じ所から雨漏りする可能性もあります。その為、雨漏りが発生した場合は再調査をさせて頂きます。ご了承ください。',
    red: true,
  },
];

export const DEFAULT_WORK_HOURS = '8：30～17：00';

// Navigation items
export const NAV_ITEMS = [
  { href: '/dashboard', label: 'ダッシュボード', icon: 'dashboard' },
  { href: '/projects', label: '案件一覧', icon: 'projects' },
  { href: '/daily-reports/new', label: '日報入力', icon: 'report' },
  { href: '/reports', label: '報告書', icon: 'reports' },
  { href: '/settings', label: '設定', icon: 'settings' },
] as const;
