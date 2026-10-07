-- 005: ユーザー管理（役割＋個別権限・無効化）とアクセス制限の見直し
-- Supabase SQL Editorで実行してください

-- ── ユーザーに個別権限・有効/無効・電話番号を追加 ──
alter table public.users
  add column if not exists permissions text[] not null default '{}',
  add column if not exists is_active boolean not null default true,
  add column if not exists phone text;

-- ── ユーザー情報の書き込みはサーバー（サービスロール）経由のみにする ──
-- これまでは本人が自分の役割（role）を書き換えられたため、画面からの直接の追加・更新を禁止する。
-- 登録・編集はユーザー管理画面（/api/users）、本人の名前変更は設定画面（/api/me）から行う。
drop policy if exists "users_insert" on public.users;
drop policy if exists "users_update" on public.users;

-- ── 読み書きをログイン中のユーザーに限定する ──
-- これまでのポリシーは対象ロールの指定がなく、ログインしていない状態（公開キー）でも読めた。
alter policy "users_select" on public.users to authenticated;

alter policy "projects_select" on public.projects to authenticated;
alter policy "projects_insert" on public.projects to authenticated;
alter policy "projects_update" on public.projects to authenticated;
alter policy "projects_delete" on public.projects to authenticated;

alter policy "daily_reports_select" on public.daily_reports to authenticated;
alter policy "daily_reports_insert" on public.daily_reports to authenticated;
alter policy "daily_reports_update" on public.daily_reports to authenticated;
alter policy "daily_reports_delete" on public.daily_reports to authenticated;

alter policy "report_photos_select" on public.report_photos to authenticated;
alter policy "report_photos_insert" on public.report_photos to authenticated;
alter policy "report_photos_delete" on public.report_photos to authenticated;

alter policy "reports_select" on public.reports to authenticated;
alter policy "reports_insert" on public.reports to authenticated;
alter policy "reports_update" on public.reports to authenticated;
alter policy "reports_delete" on public.reports to authenticated;

-- 確認用
select id, name, email, role, permissions, is_active from public.users order by created_at;
