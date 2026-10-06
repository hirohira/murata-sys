import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { DriveNotConfiguredError } from '@/lib/google-drive';
import { saveReportToDrive } from '@/lib/project-drive';

export const maxDuration = 60;

// POST /api/reports/[id]/drive — 報告書PowerPointを現場フォルダに保存
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 });

  try {
    const file = await saveReportToDrive(supabase, params.id);
    return NextResponse.json({ data: file });
  } catch (err) {
    console.error('Drive save error:', err);
    const status = err instanceof DriveNotConfiguredError ? 503 : 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'ドライブへの保存に失敗しました' },
      { status }
    );
  }
}
