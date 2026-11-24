-- 007: チャットで作る報告書（投稿の下書き）
-- Supabase SQL Editorで実行してください

create table if not exists public.report_chats (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  report_type text not null default '調査報告書' check (report_type in ('調査報告書', '完了報告書')),
  messages jsonb not null default '[]'::jsonb,
  report_id uuid references public.reports(id) on delete set null,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_report_chats_project on public.report_chats(project_id, updated_at desc);

alter table public.report_chats enable row level security;

drop policy if exists "report_chats_select" on public.report_chats;
drop policy if exists "report_chats_insert" on public.report_chats;
drop policy if exists "report_chats_update" on public.report_chats;
drop policy if exists "report_chats_delete" on public.report_chats;
create policy "report_chats_select" on public.report_chats for select to authenticated using (true);
create policy "report_chats_insert" on public.report_chats for insert to authenticated with check (true);
create policy "report_chats_update" on public.report_chats for update to authenticated using (true);
create policy "report_chats_delete" on public.report_chats for delete to authenticated using (true);

notify pgrst, 'reload schema';

-- 確認用
select count(*) as report_chats from public.report_chats;
