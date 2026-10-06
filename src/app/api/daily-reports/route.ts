import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/daily-reports — 日報一覧取得
export async function GET(request: Request) {
  const supabase = createServerSupabaseClient();
  const { searchParams } = new URL(request.url);

  const projectId = searchParams.get('projectId');
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = parseInt(searchParams.get('offset') || '0');

  let query = supabase
    .from('daily_reports')
    .select('*, project:projects(id, project_id, customer_name, site_name)', {
      count: 'exact',
    })
    .order('report_date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data, count });
}

// POST /api/daily-reports — 日報新規作成
export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = await request.json();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  const { photos, ...reportData } = body;

  // Create daily report
  const { data: report, error: reportError } = await supabase
    .from('daily_reports')
    .insert({
      ...reportData,
      created_by: user.id,
    })
    .select()
    .single();

  if (reportError) {
    return NextResponse.json({ error: reportError.message }, { status: 500 });
  }

  // If photos were uploaded, link them to this report
  if (photos && photos.length > 0) {
    const photoRecords = photos.map(
      (photo: { file_url: string; file_path: string; category: string; caption: string }, index: number) => ({
        daily_report_id: report.id,
        project_id: reportData.project_id,
        file_url: photo.file_url,
        file_path: photo.file_path,
        category: photo.category || '状況',
        caption: photo.caption || null,
        sort_order: index,
      })
    );

    const { error: photoError } = await supabase
      .from('report_photos')
      .insert(photoRecords);

    if (photoError) {
      console.error('Failed to save photos:', photoError);
    }
  }

  return NextResponse.json({ data: report }, { status: 201 });
}
