-- MURATA 日報・報告書システム — 報告書テーブル追加
-- Supabase SQL Editorで実行してください

-- ============================================================
-- REPORTS (報告書)
-- ============================================================
create table public.reports (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  report_type text not null check (report_type in ('調査報告書', '完了報告書')),
  title text not null,
  summary text,
  findings jsonb default '[]'::jsonb,
  recommendation text,
  generated_by_ai boolean not null default false,
  status text not null default '下書き' check (status in ('下書き', '確認中', '承認済み')),
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_reports_project on public.reports(project_id);
create index idx_reports_type on public.reports(report_type);
create index idx_reports_status on public.reports(status);
create index idx_reports_created_at on public.reports(created_at desc);

-- Updated_at trigger
create trigger tr_reports_updated_at
  before update on public.reports for each row execute function update_updated_at();

-- RLS
alter table public.reports enable row level security;

create policy "reports_select" on public.reports for select using (true);
create policy "reports_insert" on public.reports for insert with check (true);
create policy "reports_update" on public.reports for update using (
  auth.uid() = created_by or exists (
    select 1 from public.users where id = auth.uid() and role in ('admin', 'manager')
  )
);
create policy "reports_delete" on public.reports for delete using (
  auth.uid() = created_by or exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  )
);
