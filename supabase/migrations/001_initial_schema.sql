-- MURATA 日報・報告書システム — 初期スキーマ
-- Supabase SQL Editorで実行してください

-- UUID拡張
create extension if not exists "uuid-ossp";

-- ============================================================
-- USERS (ユーザー)
-- ============================================================
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  role text not null default 'worker' check (role in ('admin', 'manager', 'worker')),
  line_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- PROJECTS (案件)
-- ============================================================
create table public.projects (
  id uuid primary key default uuid_generate_v4(),
  project_id text not null unique,
  customer_name text not null,
  site_name text not null,
  construction_type text not null check (construction_type in (
    '雨漏り調査', '改修提案', '板金工事', '屋根工事', '外壁工事', '防水工事'
  )),
  building_type text not null check (building_type in ('住宅', '工場', '店舗')),
  address text,
  start_date date,
  status text not null default '調査中' check (status in (
    '調査中', '見積中', '受注', '施工中', '完了'
  )),
  audience_type text not null default '一般施主向け' check (audience_type in (
    '一般施主向け', '建築関係者向け'
  )),
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_projects_status on public.projects(status);
create index idx_projects_customer on public.projects(customer_name);
create index idx_projects_created_at on public.projects(created_at desc);

-- ============================================================
-- DAILY REPORTS (日報)
-- ============================================================
create table public.daily_reports (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  report_date date not null,
  weather text not null check (weather in ('晴', '曇', '雨', '雪')),
  workers_count integer not null default 1,
  work_content text not null,
  voice_memo_url text,
  safety_notes text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_daily_reports_project on public.daily_reports(project_id);
create index idx_daily_reports_date on public.daily_reports(report_date desc);

-- ============================================================
-- REPORT PHOTOS (写真)
-- ============================================================
create table public.report_photos (
  id uuid primary key default uuid_generate_v4(),
  daily_report_id uuid references public.daily_reports(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  file_url text not null,
  file_path text not null,
  category text not null default '状況' check (category in ('全体', '状況', '原因', '対策')),
  caption text,
  ai_classification text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_report_photos_daily_report on public.report_photos(daily_report_id);
create index idx_report_photos_project on public.report_photos(project_id);

-- ============================================================
-- UPDATED_AT トリガー
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger tr_users_updated_at
  before update on public.users for each row execute function update_updated_at();
create trigger tr_projects_updated_at
  before update on public.projects for each row execute function update_updated_at();
create trigger tr_daily_reports_updated_at
  before update on public.daily_reports for each row execute function update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.users enable row level security;
alter table public.projects enable row level security;
alter table public.daily_reports enable row level security;
alter table public.report_photos enable row level security;

-- Users: 全認証ユーザーが読める。自分またはadminが更新可能
create policy "users_select" on public.users for select using (true);
create policy "users_insert" on public.users for insert with check (auth.uid() = id);
create policy "users_update" on public.users for update using (
  auth.uid() = id or exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  )
);

-- Projects: 全認証ユーザーが読める。admin/managerが作成・更新可能
create policy "projects_select" on public.projects for select using (true);
create policy "projects_insert" on public.projects for insert with check (true);
create policy "projects_update" on public.projects for update using (true);
create policy "projects_delete" on public.projects for delete using (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);

-- Daily reports: 全認証ユーザーが読める。作成者またはadminが更新可能
create policy "daily_reports_select" on public.daily_reports for select using (true);
create policy "daily_reports_insert" on public.daily_reports for insert with check (true);
create policy "daily_reports_update" on public.daily_reports for update using (
  auth.uid() = created_by or exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  )
);
create policy "daily_reports_delete" on public.daily_reports for delete using (
  auth.uid() = created_by or exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  )
);

-- Photos: 全認証ユーザーが読める・作成可能。削除は作成者またはadmin
create policy "report_photos_select" on public.report_photos for select using (true);
create policy "report_photos_insert" on public.report_photos for insert with check (true);
create policy "report_photos_delete" on public.report_photos for delete using (true);

-- ============================================================
-- STORAGE BUCKET (Supabase ダッシュボードでも作成可能)
-- ============================================================
-- insert into storage.buckets (id, name, public) values ('report-photos', 'report-photos', true);
-- create policy "Anyone can read photos" on storage.objects for select using (bucket_id = 'report-photos');
-- create policy "Authenticated users can upload" on storage.objects for insert with check (bucket_id = 'report-photos' and auth.role() = 'authenticated');
-- create policy "Owner can delete" on storage.objects for delete using (bucket_id = 'report-photos' and auth.uid()::text = (storage.foldername(name))[1]);
