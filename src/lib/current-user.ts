// サーバー専用：ログイン中のユーザーと権限を取得する
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { effectivePermissions, type Permission } from '@/lib/permissions';
import type { User } from '@/types';

export interface CurrentUser {
  id: string;
  email: string;
  profile: User;
  permissions: Permission[];
}

/**
 * ログイン中のユーザーを返す（未ログインなら null）。
 * プロフィール（public.users）が無ければ「作業員」として作成する。
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  let { data: profile } = await supabase.from('users').select('*').eq('id', user.id).single();

  if (!profile) {
    const admin = createAdminClient();
    const { data: created, error } = await admin
      .from('users')
      .insert({
        id: user.id,
        name: (user.user_metadata?.name as string) || user.email?.split('@')[0] || '未設定',
        email: user.email || '',
        role: 'worker',
      })
      .select('*')
      .single();
    if (error) throw new Error(`プロフィールを作成できませんでした: ${error.message}`);
    profile = created;
  }

  return {
    id: user.id,
    email: user.email || profile.email,
    profile: profile as User,
    permissions: effectivePermissions(profile as User),
  };
}

/** 権限が無ければエラーレスポンスを返す。権限があれば null */
export function permissionError(user: CurrentUser | null, permission?: Permission) {
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  if (user.profile.is_active === false) {
    return NextResponse.json({ error: 'このアカウントは無効化されています' }, { status: 403 });
  }
  if (permission && !user.permissions.includes(permission)) {
    return NextResponse.json({ error: 'この操作を行う権限がありません' }, { status: 403 });
  }
  return null;
}
