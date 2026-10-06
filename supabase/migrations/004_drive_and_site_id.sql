-- 004: Googleドライブ連携 ＋ 現場IDを運用テンプレート形式（2026-001）に変更
-- Supabase SQL Editorで実行してください

-- ── Googleドライブ連携用の列 ──
alter table public.projects
  add column if not exists drive_folder_id text,
  add column if not exists drive_folder_url text,
  add column if not exists legacy_project_id text;

alter table public.reports
  add column if not exists drive_file_id text,
  add column if not exists drive_file_url text,
  add column if not exists drive_saved_at timestamptz;

-- ── 既存の現場IDを {登録年}-{年内連番3桁} に振り直す ──
-- 旧ID（MRT-…）は legacy_project_id に残す。登録年は日本時間、連番は登録順。
with numbered as (
  select
    id,
    extract(year from created_at at time zone 'Asia/Tokyo')::int as y,
    row_number() over (
      partition by extract(year from created_at at time zone 'Asia/Tokyo')
      order by created_at, id
    ) as n
  from public.projects
  where project_id !~ '^[0-9]{4}-[0-9]{3,}$'
),
existing_max as (
  select split_part(project_id, '-', 1)::int as y, max(split_part(project_id, '-', 2)::int) as m
  from public.projects
  where project_id ~ '^[0-9]{4}-[0-9]{3,}$'
  group by 1
)
update public.projects p
set legacy_project_id = coalesce(p.legacy_project_id, p.project_id),
    project_id = n.y || '-' || lpad((n.n + coalesce(e.m, 0))::text, 3, '0')
from numbered n
left join existing_max e on e.y = n.y
where p.id = n.id;

-- 確認用
select project_id, legacy_project_id, customer_name, site_name, created_at
from public.projects order by created_at;
