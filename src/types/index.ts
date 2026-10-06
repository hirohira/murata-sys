// MURATA 日報・報告書システム — 共通型定義

export type UserRole = 'admin' | 'manager' | 'worker';

export type ProjectStatus = '調査中' | '見積中' | '受注' | '施工中' | '完了';

export type ConstructionType =
  | '雨漏り調査'
  | '改修提案'
  | '板金工事'
  | '屋根工事'
  | '外壁工事'
  | '防水工事';

export type BuildingType = '住宅' | '工場' | '店舗';

export type AudienceType = '一般施主向け' | '建築関係者向け';

export type Weather = '晴' | '曇' | '雨' | '雪';

export type PhotoCategory = '全体' | '状況' | '原因' | '対策';

// Database row types
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  line_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  project_id: string; // MRT-{YYYYMMDD}{seq}_{customer}_{site}_{type}_{start}
  customer_name: string;
  site_name: string;
  construction_type: ConstructionType;
  building_type: BuildingType;
  address: string | null;
  start_date: string | null;
  status: ProjectStatus;
  audience_type: AudienceType;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DailyReport {
  id: string;
  project_id: string;
  report_date: string;
  weather: Weather;
  workers_count: number;
  work_content: string;
  voice_memo_url: string | null;
  safety_notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  project?: Project;
  photos?: ReportPhoto[];
}

export interface ReportPhoto {
  id: string;
  daily_report_id: string | null;
  project_id: string;
  file_url: string;
  file_path: string;
  category: PhotoCategory;
  caption: string | null;
  ai_classification: string | null;
  sort_order: number;
  created_at: string;
}

// Form input types
export interface ProjectFormData {
  customer_name: string;
  site_name: string;
  construction_type: ConstructionType;
  building_type: BuildingType;
  address: string;
  start_date: string;
  status: ProjectStatus;
  audience_type: AudienceType;
}

export interface DailyReportFormData {
  project_id: string;
  report_date: string;
  weather: Weather;
  workers_count: number;
  work_content: string;
  safety_notes: string;
}

// Photo entry for client-side handling
export interface PhotoEntry {
  id: string;
  file: File;
  preview: string;
  category: PhotoCategory;
  caption: string;
  uploading?: boolean;
  uploaded_url?: string;
  uploaded_path?: string;
}
