-- 006: 案件ごとの写真（3方式の撮影・アップ）と区分の見直し
-- Supabase SQL Editorで実行してください

-- ── 区分を「現状・原因・対策・その他」に統一 ──
-- 旧区分の写真は「全体→その他」「状況→現状」に移す
alter table public.report_photos drop constraint if exists report_photos_category_check;
update public.report_photos set category = 'その他' where category = '全体';
update public.report_photos set category = '現状' where category = '状況';
alter table public.report_photos alter column category set default '現状';
alter table public.report_photos
  add constraint report_photos_category_check check (category in ('現状', '原因', '対策', 'その他'));

-- ── 案件の写真として使う列を追加 ──
alter table public.report_photos
  add column if not exists capture_method text check (capture_method in ('camera', 'select', 'inapp')),
  add column if not exists taken_at timestamptz,
  add column if not exists width integer,
  add column if not exists height integer,
  add column if not exists created_by uuid references public.users(id),
  add column if not exists drive_file_id text,
  add column if not exists drive_file_url text,
  add column if not exists drive_file_name text;

create index if not exists idx_report_photos_project_created on public.report_photos(project_id, created_at desc);

-- 区分の付け替え用（これまで更新のポリシーがなかった）
drop policy if exists "report_photos_update" on public.report_photos;
create policy "report_photos_update" on public.report_photos for update to authenticated using (true);

-- 確認用
select category, count(*) from public.report_photos group by 1 order by 1;
