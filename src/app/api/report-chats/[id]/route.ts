import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getCurrentUser, permissionError } from '@/lib/current-user';
import { sanitizeMessages } from '@/lib/report-chat';

// GET /api/report-chats/[id]
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  const denied = permissionError(me);
  if (denied) return denied;
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('report_chats')
    .select('*, project:projects(*)')
    .eq('id', params.id)
    .single();
  if (error || !data) return NextResponse.json({ error: 'チャットが見つかりません' }, { status: 404 });
  return NextResponse.json({ data });
}

// PUT /api/report-chats/[id] — 投稿を保存 { messages, updated_at? }
// updated_at を送ると、ほかの人が先に保存していた場合は 409 を返す（上書き防止）
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  const denied = permissionError(me);
  if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as { messages?: unknown; updated_at?: string };
  const messages = sanitizeMessages(body.messages);
  if (!messages) return NextResponse.json({ error: '投稿の形式が正しくありません' }, { status: 400 });

  const supabase = createServerSupabaseClient();
  if (body.updated_at) {
    const { data: cur } = await supabase.from('report_chats').select('updated_at').eq('id', params.id).single();
    if (cur && new Date(cur.updated_at).getTime() !== new Date(body.updated_at).getTime()) {
      return NextResponse.json({ error: 'ほかの人が先に投稿しました。画面を読み込み直してください', conflict: true }, { status: 409 });
    }
  }
  const { data, error } = await supabase
    .from('report_chats')
    .update({ messages, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select('id, updated_at')
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message || '保存できませんでした' }, { status: 500 });
  return NextResponse.json({ data });
}

// DELETE /api/report-chats/[id] — チャットを削除（写真は案件写真に残る）
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  const denied = permissionError(me);
  if (denied) return denied;
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from('report_chats').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: { ok: true } });
}
