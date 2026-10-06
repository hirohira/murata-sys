import { createServerSupabaseClient } from '@/lib/supabase/server';
import { generateProjectId } from '@/lib/project-id';
import { NextResponse } from 'next/server';

// GET /api/projects — 案件一覧取得
export async function GET(request: Request) {
  const supabase = createServerSupabaseClient();
  const { searchParams } = new URL(request.url);

  const status = searchParams.get('status');
  const search = searchParams.get('search');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  let query = supabase
    .from('projects')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  if (search) {
    query = query.or(
      `customer_name.ilike.%${search}%,site_name.ilike.%${search}%,project_id.ilike.%${search}%`
    );
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data, count });
}

// POST /api/projects — 案件新規作成
export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = await request.json();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  // Generate project ID: count today's projects for sequence number
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const { count } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', `${dateStr}T00:00:00`)
    .lt('created_at', `${dateStr}T23:59:59`);

  const sequenceNumber = (count || 0) + 1;

  const projectId = generateProjectId({
    customerName: body.customer_name,
    siteName: body.site_name,
    constructionType: body.construction_type,
    startDate: body.start_date || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`,
    sequenceNumber,
    createdDate: today,
  });

  const { data, error } = await supabase
    .from('projects')
    .insert({
      project_id: projectId,
      customer_name: body.customer_name,
      site_name: body.site_name,
      construction_type: body.construction_type,
      building_type: body.building_type,
      address: body.address || null,
      start_date: body.start_date || null,
      status: body.status || '調査中',
      audience_type: body.audience_type || '一般施主向け',
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    // If unique constraint violation on project_id, retry with next sequence
    if (error.code === '23505') {
      const retryId = generateProjectId({
        customerName: body.customer_name,
        siteName: body.site_name,
        constructionType: body.construction_type,
        startDate: body.start_date || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`,
        sequenceNumber: sequenceNumber + 1,
        createdDate: today,
      });

      const { data: retryData, error: retryError } = await supabase
        .from('projects')
        .insert({
          ...body,
          project_id: retryId,
          created_by: user.id,
        })
        .select()
        .single();

      if (retryError) {
        return NextResponse.json({ error: retryError.message }, { status: 500 });
      }
      return NextResponse.json({ data: retryData }, { status: 201 });
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
