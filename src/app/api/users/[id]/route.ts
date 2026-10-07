import { NextResponse } from 'next/server';
import { getCurrentUser, permissionError } from '@/lib/current-user';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkGrant, parsePermissions, parseRole, validatePassword } from '@/lib/user-admin';
import type { User } from '@/types';

// PATCH /api/users/[id] — ユーザー編集（名前・メール・役割・権限・有効/無効・パスワード再設定）
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const me = await getCurrentUser();
    const err = permissionError(me, 'manage_users');
    if (err) return err;

    const admin = createAdminClient();
    const { data: target } = await admin.from('users').select('*').eq('id', params.id).single();
    if (!target) return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 });
    const t = target as User;
    const isSelf = t.id === me!.id;

    const body = await req.json();
    const update: Record<string, unknown> = {};

    if (typeof body.name === 'string') {
      if (!body.name.trim()) return NextResponse.json({ error: '名前を入力してください' }, { status: 400 });
      update.name = body.name.trim();
    }
    if (typeof body.phone === 'string') update.phone = body.phone.trim() || null;

    const role = body.role !== undefined ? parseRole(body.role) : t.role;
    if (!role) return NextResponse.json({ error: '役割の指定が正しくありません' }, { status: 400 });
    const permissions = body.permissions !== undefined ? parsePermissions(body.permissions) : parsePermissions(t.permissions);
    const isActive = typeof body.is_active === 'boolean' ? body.is_active : t.is_active !== false;

    const changingAccess =
      role !== t.role ||
      isActive !== (t.is_active !== false) ||
      JSON.stringify([...permissions].sort()) !== JSON.stringify(parsePermissions(t.permissions).sort());

    if (changingAccess) {
      if (isSelf) {
        return NextResponse.json(
          { error: '自分の役割・権限・有効状態は変更できません（ほかの管理者に依頼してください）' },
          { status: 403 }
        );
      }
      const grantError = checkGrant(me!, { targetCurrentRole: t.role, role, permissions });
      if (grantError) return NextResponse.json({ error: grantError }, { status: 403 });

      // 有効な管理者が1人もいなくなる変更は不可
      if (t.role === 'admin' && t.is_active !== false && (role !== 'admin' || !isActive)) {
        const { count } = await admin
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'admin')
          .neq('is_active', false)
          .neq('id', t.id);
        if (!count) {
          return NextResponse.json({ error: '有効な管理者が1人もいなくなるため変更できません' }, { status: 400 });
        }
      }
      update.role = role;
      update.permissions = permissions;
      update.is_active = isActive;
    } else if (t.role === 'admin' && me!.profile.role !== 'admin' && Object.keys(update).length > 0) {
      return NextResponse.json({ error: '管理者の情報は管理者のみ変更できます' }, { status: 403 });
    }

    // 認証側（メール・パスワード・ログイン可否）
    const authUpdate: Record<string, unknown> = {};
    if (typeof body.email === 'string' && body.email.trim().toLowerCase() !== t.email) {
      const email = body.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: 'メールアドレスの形式が正しくありません' }, { status: 400 });
      }
      authUpdate.email = email;
      authUpdate.email_confirm = true;
      update.email = email;
    }
    if (body.password) {
      const pwError = validatePassword(body.password);
      if (pwError) return NextResponse.json({ error: pwError }, { status: 400 });
      authUpdate.password = body.password;
    }
    if (isActive !== (t.is_active !== false)) {
      // 無効化 = ログイン禁止（約100年）。有効化で解除
      authUpdate.ban_duration = isActive ? 'none' : '876000h';
    }
    if (Object.keys(authUpdate).length > 0) {
      const { error } = await admin.auth.admin.updateUserById(t.id, authUpdate);
      if (error) {
        const msg = /already|registered|exists/i.test(error.message)
          ? 'このメールアドレスはすでに使われています'
          : error.message;
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    }

    if (Object.keys(update).length === 0) return NextResponse.json({ data: t });
    const { data, error } = await admin.from('users').update(update).eq('id', t.id).select('*').single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '更新に失敗しました' }, { status: 500 });
  }
}
