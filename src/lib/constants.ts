// MURATA システム定数

import type {
  ProjectStatus,
  ConstructionType,
  BuildingType,
  AudienceType,
  Weather,
  PhotoCategory,
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

// Navigation items
export const NAV_ITEMS = [
  { href: '/dashboard', label: 'ダッシュボード', icon: 'dashboard' },
  { href: '/projects', label: '案件一覧', icon: 'projects' },
  { href: '/daily-reports/new', label: '日報入力', icon: 'report' },
  { href: '/settings', label: '設定', icon: 'settings' },
] as const;
