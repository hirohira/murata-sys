// サーバー専用：サービスロールキーで Supabase を操作する（ユーザー登録・無効化など）
import { createClient } from '@supabase/supabase-js';

export class AdminNotConfiguredError extends Error {
  constructor() {
    super('サーバーの設定（SUPABASE_SERVICE_ROLE_KEY）が未登録のため、ユーザー管理を利用できません');
    this.name = 'AdminNotConfiguredError';
  }
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new AdminNotConfiguredError();
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
