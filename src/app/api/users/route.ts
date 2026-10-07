import { NextResponse } from 'next/server';
import { getCurrentUser, permissionError } from '@/lib/current-user';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkGrant, parsePermissions, parseRole, validatePassword } from '@/lib/user-admin';

function fail(e: unknown, fallback: string) {
  return NextResponse.json({ error: e instanceof Error ? e.message : fallback }, { status: 500 });
}

// GET /api/users — ユーザー一覧（ユーザー登録・編集の権限が必要）
export async function GET() {
  try {
    const me = await getCurrentUser();
    const err = permissionError(me, 'manage_users');
    if (err) return err;

    const admin = createAdminClient();
    const { data: users, error } = await admin.from('users').select('*').order('created_at');
    if (error) throw new Error(error.message);

    // 最終ログイン日時（認証側の情報）
    const { data: authList } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const lastSignIn = new Map((authList?.users ?? []).map((u) => [u.id, u.last_sign_in_at ?? null]));

    return NextResponse.json({
      data: (users ?? []).map((u) => ({ ...u, last_sign_in_at: lastSignIn.get(u.id) ?? null })),
      me: { id: me!.id, role: me!.profile.role, permissions: me!.permissions },
    });
  } catch (e) {
    return fail(e, 'ユーザー一覧を取得できませんでした');
  }
}

// POST /api/users — ユーザー登録（登録者が仮パスワードを決める）
export async function POST(req: Request) {
  try {
    const me = await getCurrentUser();
    const err = permissionError(me, 'manage_users');
    if (err) return err;

    const body = await req.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const role = parseRole(body.role) ?? 'worker';
    const permissions = parsePermissions(body.permissions);

    if (!name) return NextResponse.json({ error: '名前を入力してください' }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'メールアドレスの形式が正しくありません' }, { status: 400 });
    }
    const pwError = validatePassword(body.password);
    if (pwError) return NextResponse.json({ error: pwError }, { status: 400 });
    const grantError = checkGrant(me!, { role, permissions });
    if (grantError) return NextResponse.json({ error: grantError }, { status: 403 });

    const admin = createAdminClient();
    const { data: created, error: authError } = await admin.auth.admin.createUser({
      email,
      password: body.password,
      email_confirm: true,
      user_metadata: { name },
    });
    if (authError || !created.user) {
      const msg = /already|registered|exists/i.test(authError?.message ?? '')
        ? 'このメールアドレスはすでに登録されています'
        : authError?.message || '登録に失敗しました';
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { data: profile, error: profileError } = await admin
      .from('users')
      .upsert({
        id: created.user.id,
        name,
        email,
        role,
        permissions,
        phone: typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim() : null,
        is_active: true,
      })
      .select('*')
      .single();
    if (profileError) {
      // プロフィールが作れなければ認証側も取り消す
      await admin.auth.admin.deleteUser(created.user.id);
      throw new Error(profileError.message);
    }

    return NextResponse.json({ data: profile }, { status: 201 });
  } catch (e) {
    return fail(e, '登録に失敗しました');
  }
}
