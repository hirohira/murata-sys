import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getCurrentUser, permissionError } from '@/lib/current-user';
import { NextResponse } from 'next/server';

// GET /api/projects/[id] — 案件詳細取得
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json({ data });
}

// PATCH /api/projects/[id] — 案件更新
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabaseClient();
  const body = await request.json();

  const { data, error } = await supabase
    .from('projects')
    .update(body)
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

// DELETE /api/projects/[id] — 案件削除
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  // 案件の削除は「案件の削除」権限が必要
  const me = await getCurrentUser();
  const denied = permissionError(me, 'delete_projects');
  if (denied) return denied;

  const supabase = createServerSupabaseClient();

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
