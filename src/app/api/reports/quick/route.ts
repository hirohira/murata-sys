import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getCurrentUser, permissionError } from '@/lib/current-user';
import { isDriveConfigured } from '@/lib/google-drive';
import { collectPhotos, planReport, summarizePhotos, usedPhotoKeys } from '@/lib/quick-report';
import type { Project, ReportType } from '@/types';

export const maxDuration = 60;

const TYPES: ReportType[] = ['調査報告書', '完了報告書'];

async function loadProject(id: string | null) {
  const supabase = createServerSupabaseClient();
  if (!id) return { supabase, project: null };
  const { data } = await supabase.from('projects').select('*').eq('id', id).single();
  return { supabase, project: data as Project | null };
}

// GET /api/reports/quick?projectId=&type= — 使える写真の枚数（区分ごと）と写真フォルダのURL
export async function GET(req: Request) {
  const me = await getCurrentUser();
  const denied = permissionError(me);
  if (denied) return denied;
  const url = new URL(req.url);
  const type = (url.searchParams.get('type') as ReportType) || '調査報告書';
  const { supabase, project } = await loadProject(url.searchParams.get('projectId'));
  if (!project) return NextResponse.json({ error: '案件が見つかりません' }, { status: 404 });

  const { photos, driveError, photoFolderUrl } = await collectPhotos(supabase, project, type);
  return NextResponse.json({
    data: {
      total: photos.length,
      summary: summarizePhotos(photos),
      photoFolderUrl,
      driveConfigured: isDriveConfigured(),
      driveError,
    },
  });
}

// POST /api/reports/quick — 手順1：写真を集め、AIが章立て・写真の割り当て・文章を決める
// body: { project_id, report_type, scenario }
// 返り値の photos は報告書に使う写真だけ。ドライブの写真は画面側で取り込んでから finalize に渡す
export async function POST(req: Request) {
  const me = await getCurrentUser();
  const denied = permissionError(me);
  if (denied) return denied;

  const body = (await req.json()) as { project_id?: string; report_type?: ReportType; scenario?: string };
  const reportType = body.report_type && TYPES.includes(body.report_type) ? body.report_type : '調査報告書';
  const scenario = (body.scenario || '').slice(0, 4000);
  const { supabase, project } = await loadProject(body.project_id ?? null);
  if (!project) return NextResponse.json({ error: '案件が見つかりません' }, { status: 404 });

  try {
    const { photos } = await collectPhotos(supabase, project, reportType);
    if (photos.length === 0 && !scenario.trim()) {
      return NextResponse.json(
        { error: '写真もシナリオもありません。写真を区分フォルダに入れるか、シナリオを入力してください。' },
        { status: 400 }
      );
    }
    const plan = await planReport({ project, reportType, scenario, photos });
    const used = new Set(usedPhotoKeys(plan, photos));
    return NextResponse.json({
      data: {
        plan,
        photos: photos.filter((p) => used.has(p.key)),
        photosAvailable: photos.length,
      },
    });
  } catch (e) {
    console.error('Quick report plan failed:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : '報告書の作成に失敗しました' }, { status: 500 });
  }
}
