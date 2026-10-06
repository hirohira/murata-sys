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

export type ReportType = '調査報告書' | '完了報告書';

export type ReportStatus = '下書き' | '確認中' | '承認済み';

export type FindingSeverity = '要補修' | '経過観察' | '問題なし';

export type ReportStyle = '茂様式' | '大野様式';

export type InputPattern = 'onsite' | 'office';

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
  project_id: string; // 現場ID {登録年}-{連番3桁} 例: 2026-001
  customer_name: string;
  site_name: string;
  construction_type: ConstructionType;
  building_type: BuildingType;
  address: string | null;
  start_date: string | null;
  status: ProjectStatus;
  audience_type: AudienceType;
  drive_folder_id?: string | null;
  drive_folder_url?: string | null;
  legacy_project_id?: string | null;
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

export interface ReportFinding {
  photoId?: string;
  photoNumber: number;
  photoUrl?: string;
  location: string;
  finding: string;
  severity: FindingSeverity;
  recommendation: string;
}

// Chapter-based report structure (for 4-step wizard)
export type PhotoTag = 'before' | 'after';

export interface ChapterPhoto {
  id: string;
  file?: File;         // client-side only
  preview?: string;    // client-side blob URL
  url?: string;        // uploaded Supabase Storage URL
  path?: string;       // Supabase Storage path
  caption: string;
  sort_order: number;
  tag?: PhotoTag;      // 完了報告書: 施工前/施工後タグ
}

export interface ReportChapter {
  id: string;
  title: string;
  key: string;         // e.g. 'cover', 'overview', 'condition', etc.
  photos: ChapterPhoto[];
  description: string; // AI-generated or manually entered text
  ai_generated: boolean;
  sort_order: number;
}

export interface ReportMeta {
  input_pattern?: InputPattern;
  report_style?: ReportStyle;
  survey_date?: string;
  addressee?: string;
  construction_name?: string;
  purpose?: string;
}

export interface Report {
  id: string;
  project_id: string;
  report_type: ReportType;
  title: string;
  summary: string | null;
  findings: ReportFinding[];
  chapters: ReportChapter[];
  meta: ReportMeta | null;
  recommendation: string | null;
  generated_by_ai: boolean;
  status: ReportStatus;
  drive_file_id?: string | null;
  drive_file_url?: string | null;
  drive_saved_at?: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  project?: Project;
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
