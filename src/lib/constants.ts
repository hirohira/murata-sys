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

// Default chapters for 調査報告書
export const SURVEY_REPORT_CHAPTERS = [
  { key: 'cover', title: '表紙' },
  { key: 'overview', title: '①建物全体把握・全景' },
  { key: 'condition', title: '②対象部位の状況' },
  { key: 'water_test', title: '散水調査' },
  { key: 'cause', title: '③原因特定' },
  { key: 'measures', title: '④必要な対策' },
  { key: 'proposal', title: '⑤修繕・工事提案' },
  { key: 'schedule', title: '工事日数・特記事項' },
  { key: 'company', title: '会社案内' },
] as const;

// Default chapters for 完了報告書
export const COMPLETION_REPORT_CHAPTERS = [
  { key: 'cover', title: '表紙' },
  { key: 'before', title: '施工前の状況' },
  { key: 'work', title: '施工内容' },
  { key: 'after', title: '施工後の状況' },
  { key: 'detail', title: '施工詳細' },
  { key: 'warranty', title: '保証・メンテナンス' },
  { key: 'company', title: '会社案内' },
] as const;

// Navigation items
export const NAV_ITEMS = [
  { href: '/dashboard', label: 'ダッシュボード', icon: 'dashboard' },
  { href: '/projects', label: '案件一覧', icon: 'projects' },
  { href: '/daily-reports/new', label: '日報入力', icon: 'report' },
  { href: '/reports', label: '報告書', icon: 'reports' },
  { href: '/settings', label: '設定', icon: 'settings' },
] as const;
