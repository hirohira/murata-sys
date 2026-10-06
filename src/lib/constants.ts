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
// 章タイトルには番号を付けない（出力時に①②…を自動採番する）
// ※ 工事種別ごとの章立ては仮案。MURATA様に確認のうえ差し替える。
export interface ChapterTemplate {
  key: string;
  title: string;
}

const COVER: ChapterTemplate = { key: 'cover', title: '表紙' };
const COMPANY: ChapterTemplate = { key: 'company', title: '会社案内' };
const SCHEDULE: ChapterTemplate = { key: 'schedule', title: '工事日数・特記事項' };
const WARRANTY: ChapterTemplate = { key: 'warranty', title: '保証・メンテナンス' };
const BEFORE: ChapterTemplate = { key: 'before', title: '施工前の状況' };
const AFTER: ChapterTemplate = { key: 'after', title: '施工後の状況' };

// 調査報告書（工事種別ごと）
export const SURVEY_CHAPTER_TEMPLATES: Record<ConstructionType, ChapterTemplate[]> = {
  '雨漏り調査': [
    COVER,
    { key: 'overview', title: '建物全体把握・全景' },
    { key: 'condition', title: '対象部位の状況' },
    { key: 'water_test', title: '散水調査' },
    { key: 'cause', title: '原因特定' },
    { key: 'measures', title: '必要な対策' },
    { key: 'proposal', title: '修繕・工事提案' },
    SCHEDULE,
    COMPANY,
  ],
  '改修提案': [
    COVER,
    { key: 'overview', title: '建物概要・全景' },
    { key: 'condition', title: '現況調査' },
    { key: 'evaluation', title: '劣化状況の評価' },
    { key: 'policy', title: '改修方針' },
    { key: 'proposal', title: '改修工事のご提案' },
    SCHEDULE,
    COMPANY,
  ],
  '板金工事': [
    COVER,
    { key: 'overview', title: '建物全体・全景' },
    { key: 'condition', title: '板金部の状況' },
    { key: 'defects', title: '劣化・不具合箇所' },
    { key: 'measures', title: '原因と対策' },
    { key: 'proposal', title: '工事のご提案' },
    SCHEDULE,
    COMPANY,
  ],
  '屋根工事': [
    COVER,
    { key: 'overview', title: '建物全体・全景' },
    { key: 'condition', title: '屋根材の状況' },
    { key: 'details', title: '棟・谷・軒先の状況' },
    { key: 'defects', title: '劣化・不具合箇所' },
    { key: 'measures', title: '必要な対策' },
    { key: 'proposal', title: '工事のご提案' },
    SCHEDULE,
    COMPANY,
  ],
  '外壁工事': [
    COVER,
    { key: 'overview', title: '建物全体・全景' },
    { key: 'condition', title: '外壁材の状況' },
    { key: 'sealing', title: 'シーリングの状況' },
    { key: 'defects', title: 'ひび割れ・浮き等の不具合' },
    { key: 'measures', title: '必要な対策' },
    { key: 'proposal', title: '工事のご提案' },
    SCHEDULE,
    COMPANY,
  ],
  '防水工事': [
    COVER,
    { key: 'overview', title: '建物全体・全景' },
    { key: 'condition', title: '防水層の状況' },
    { key: 'drain', title: '排水口・ドレン廻りの状況' },
    { key: 'defects', title: '劣化・不具合箇所' },
    { key: 'measures', title: '必要な対策' },
    { key: 'proposal', title: '工事のご提案' },
    SCHEDULE,
    COMPANY,
  ],
};

// 完了報告書（工事種別ごと）
const COMPLETION_DEFAULT: ChapterTemplate[] = [
  COVER,
  BEFORE,
  { key: 'work', title: '施工内容' },
  AFTER,
  { key: 'detail', title: '施工詳細' },
  WARRANTY,
  COMPANY,
];

export const COMPLETION_CHAPTER_TEMPLATES: Record<ConstructionType, ChapterTemplate[]> = {
  '雨漏り調査': [
    COVER,
    BEFORE,
    { key: 'work', title: '雨漏り原因と処置内容' },
    { key: 'process', title: '施工中の様子' },
    AFTER,
    { key: 'water_test', title: '散水による確認' },
    WARRANTY,
    COMPANY,
  ],
  '改修提案': COMPLETION_DEFAULT,
  '板金工事': [
    COVER,
    BEFORE,
    { key: 'work', title: '板金加工・取付' },
    AFTER,
    WARRANTY,
    COMPANY,
  ],
  '屋根工事': [
    COVER,
    BEFORE,
    { key: 'work', title: '下地・防水シート施工' },
    { key: 'process', title: '屋根材施工' },
    AFTER,
    WARRANTY,
    COMPANY,
  ],
  '外壁工事': [
    COVER,
    BEFORE,
    { key: 'work', title: '下地補修・シーリング' },
    { key: 'process', title: '塗装・張替え工程' },
    AFTER,
    WARRANTY,
    COMPANY,
  ],
  '防水工事': [
    COVER,
    BEFORE,
    { key: 'work', title: '下地処理' },
    { key: 'process', title: '防水層施工' },
    AFTER,
    WARRANTY,
    COMPANY,
  ],
};

export function getChapterTemplate(
  reportType: ReportType,
  constructionType?: ConstructionType | null
): ChapterTemplate[] {
  if (reportType === '調査報告書') {
    return SURVEY_CHAPTER_TEMPLATES[constructionType ?? '雨漏り調査'] ?? SURVEY_CHAPTER_TEMPLATES['雨漏り調査'];
  }
  return (constructionType && COMPLETION_CHAPTER_TEMPLATES[constructionType]) || COMPLETION_DEFAULT;
}

// Navigation items
export const NAV_ITEMS = [
  { href: '/dashboard', label: 'ダッシュボード', icon: 'dashboard' },
  { href: '/projects', label: '案件一覧', icon: 'projects' },
  { href: '/daily-reports/new', label: '日報入力', icon: 'report' },
  { href: '/reports', label: '報告書', icon: 'reports' },
  { href: '/settings', label: '設定', icon: 'settings' },
] as const;
