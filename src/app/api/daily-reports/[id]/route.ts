import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/daily-reports/[id] — 日報詳細取得
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('daily_reports')
    .select(
      '*, project:projects(id, project_id, customer_name, site_name), photos:report_photos(*)'
    )
    .eq('id', params.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json({ data });
}

// PATCH /api/daily-reports/[id] — 日報更新
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabaseClient();
  const body = await request.json();

  const { data, error } = await supabase
    .from('daily_reports')
    .update(body)
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

// DELETE /api/daily-reports/[id] — 日報削除
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabaseClient();

  const { error } = await supabase
    .from('daily_reports')
    .delete()
    .eq('id', params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
