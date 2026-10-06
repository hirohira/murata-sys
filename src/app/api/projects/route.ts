import { createServerSupabaseClient } from '@/lib/supabase/server';
import { nextProjectId, jstParts } from '@/lib/project-id';
import { ensureProjectDriveFolder } from '@/lib/project-drive';
import { isDriveConfigured } from '@/lib/google-drive';
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

  // 現場ID: {登録年}-{年内連番3桁}（例: 2026-001）
  const { year } = jstParts();
  const record = {
    customer_name: body.customer_name,
    site_name: body.site_name,
    construction_type: body.construction_type,
    building_type: body.building_type,
    address: body.address || null,
    start_date: body.start_date || null,
    status: body.status || '調査中',
    audience_type: body.audience_type || '一般施主向け',
    created_by: user.id,
  };

  // 同時登録で連番が重なった場合に備えて数回やり直す
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: existing, error: listError } = await supabase
      .from('projects')
      .select('project_id')
      .like('project_id', `${year}-%`);

    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 500 });
    }

    const projectId = nextProjectId((existing || []).map((r) => r.project_id), year);

    const { data, error } = await supabase
      .from('projects')
      .insert({ ...record, project_id: projectId })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') continue; // 現場IDの重複 → 採番し直し
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Googleドライブに現場フォルダを作成（失敗しても案件登録は成功扱い）
    let driveError: string | null = null;
    if (isDriveConfigured()) {
      try {
        const folder = await ensureProjectDriveFolder(supabase, data);
        Object.assign(data, { drive_folder_id: folder.id, drive_folder_url: folder.url });
      } catch (err) {
        console.error('Drive folder creation failed:', err);
        driveError = err instanceof Error ? err.message : 'フォルダ作成に失敗しました';
      }
    }

    return NextResponse.json({ data, driveError }, { status: 201 });
  }

  return NextResponse.json(
    { error: '現場IDの採番に失敗しました。もう一度お試しください' },
    { status: 500 }
  );
}
