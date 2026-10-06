import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { DriveNotConfiguredError } from '@/lib/google-drive';
import { ensureProjectDriveFolder } from '@/lib/project-drive';

// POST /api/projects/[id]/drive-folder — 現場フォルダを作成（既にあれば再利用）
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 });

  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', params.id)
    .single();
  if (error || !project) {
    return NextResponse.json({ error: '案件が見つかりません' }, { status: 404 });
  }

  try {
    const folder = await ensureProjectDriveFolder(supabase, project);
    return NextResponse.json({ data: folder });
  } catch (err) {
    console.error('Drive folder error:', err);
    const status = err instanceof DriveNotConfiguredError ? 503 : 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'フォルダ作成に失敗しました' },
      { status }
    );
  }
}
