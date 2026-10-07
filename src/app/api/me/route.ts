import { NextResponse } from 'next/server';
import { getCurrentUser, permissionError } from '@/lib/current-user';
import { createAdminClient } from '@/lib/supabase/admin';

// GET /api/me — ログイン中のユーザー情報と権限
export async function GET() {
  try {
    const me = await getCurrentUser();
    const err = permissionError(me);
    if (err) return err;
    return NextResponse.json({ data: { ...me!.profile, email: me!.email, effective_permissions: me!.permissions } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '取得に失敗しました' }, { status: 500 });
  }
}

// PATCH /api/me — 自分の名前・電話番号を変更（役割・権限は変更不可）
export async function PATCH(req: Request) {
  try {
    const me = await getCurrentUser();
    const err = permissionError(me);
    if (err) return err;

    const body = (await req.json()) as { name?: string; phone?: string };
    const update: Record<string, string | null> = {};
    if (typeof body.name === 'string') {
      if (!body.name.trim()) return NextResponse.json({ error: '名前を入力してください' }, { status: 400 });
      update.name = body.name.trim();
    }
    if (typeof body.phone === 'string') update.phone = body.phone.trim() || null;

    const { data, error } = await createAdminClient()
      .from('users')
      .update(update)
      .eq('id', me!.id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '更新に失敗しました' }, { status: 500 });
  }
}
