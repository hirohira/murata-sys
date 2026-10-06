import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// GET /api/reports/[id] — 報告書詳細
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from('reports')
      .select('*, project:projects(id, project_id, customer_name, site_name, construction_type, building_type, address, audience_type)')
      .eq('id', params.id)
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (err) {
    console.error('Report GET error:', err);
    return NextResponse.json(
      { error: '報告書の取得に失敗しました' },
      { status: 500 }
    );
  }
}

// PATCH /api/reports/[id] — 報告書更新
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient();
    const body = await req.json();

    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.summary !== undefined) updateData.summary = body.summary;
    if (body.findings !== undefined) updateData.findings = body.findings;
    if (body.recommendation !== undefined) updateData.recommendation = body.recommendation;
    if (body.chapters !== undefined) updateData.chapters = body.chapters;
    if (body.meta !== undefined) updateData.meta = body.meta;
    if (body.status !== undefined) updateData.status = body.status;

    const { data, error } = await supabase
      .from('reports')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (err) {
    console.error('Report PATCH error:', err);
    return NextResponse.json(
      { error: '報告書の更新に失敗しました' },
      { status: 500 }
    );
  }
}

// DELETE /api/reports/[id] — 報告書削除
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient();

    const { error } = await supabase
      .from('reports')
      .delete()
      .eq('id', params.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Report DELETE error:', err);
    return NextResponse.json(
      { error: '報告書の削除に失敗しました' },
      { status: 500 }
    );
  }
}
