import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// GET /api/reports — 報告書一覧
export async function GET(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const reportType = searchParams.get('reportType');
    const status = searchParams.get('status');

    let query = supabase
      .from('reports')
      .select('*, project:projects(id, project_id, customer_name, site_name, construction_type)')
      .order('created_at', { ascending: false });

    if (projectId) query = query.eq('project_id', projectId);
    if (reportType) query = query.eq('report_type', reportType);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (err) {
    console.error('Reports GET error:', err);
    return NextResponse.json(
      { error: '報告書の取得に失敗しました' },
      { status: 500 }
    );
  }
}

// POST /api/reports — 報告書作成
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const body = await req.json();

    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('reports')
      .insert({
        project_id: body.project_id,
        report_type: body.report_type,
        title: body.title,
        summary: body.summary || null,
        findings: body.findings || [],
        chapters: body.chapters || [],
        meta: body.meta || null,
        recommendation: body.recommendation || null,
        generated_by_ai: body.generated_by_ai || false,
        status: body.status || '下書き',
        created_by: user?.id || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    console.error('Reports POST error:', err);
    return NextResponse.json(
      { error: '報告書の作成に失敗しました' },
      { status: 500 }
    );
  }
}
