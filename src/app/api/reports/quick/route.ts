import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getCurrentUser, permissionError } from '@/lib/current-user';
import { saveReportToDrive } from '@/lib/project-drive';
import { isDriveConfigured } from '@/lib/google-drive';
import { buildChapters, collectPhotos, planReport, summarizePhotos } from '@/lib/quick-report';
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

// POST /api/reports/quick — シナリオと写真から報告書を作り、PowerPointをドライブに保存する
// body: { project_id, report_type, scenario }
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
    const { chapters, usedPhotos, failedPhotos } = await buildChapters({
      supabase,
      project,
      userId: me!.id,
      reportType,
      plan,
      photos,
    });

    const constructionName = plan.construction_name?.trim() || `${project.site_name}`;
    const { data: report, error } = await supabase
      .from('reports')
      .insert({
        project_id: project.id,
        report_type: reportType,
        title: `${constructionName} ${reportType}`,
        summary: scenario || null,
        findings: [],
        chapters,
        meta: {
          input_pattern: 'office',
          survey_date: new Date().toISOString().slice(0, 10),
          addressee: `${project.customer_name}　様`,
          construction_name: constructionName,
          purpose: plan.purpose?.trim() || '',
          staff_name: me!.profile.name,
        },
        generated_by_ai: true,
        status: '下書き',
        created_by: me!.id,
      })
      .select('id')
      .single();
    if (error || !report) throw new Error(error?.message || '報告書を保存できませんでした');

    let drive: { url: string; name: string } | null = null;
    let driveError: string | null = null;
    if (isDriveConfigured()) {
      try {
        const saved = await saveReportToDrive(supabase, report.id);
        drive = { url: saved.url, name: saved.name };
      } catch (e) {
        console.error('Quick report drive save failed:', e);
        driveError = e instanceof Error ? e.message : 'ドライブへの保存に失敗しました';
      }
    }

    return NextResponse.json(
      {
        data: {
          id: report.id,
          chapters: chapters.filter((c) => !['cover', 'schedule', 'company'].includes(c.key)).length,
          photosAvailable: photos.length,
          photosUsed: usedPhotos,
          photosFailed: failedPhotos,
          drive,
          driveError,
        },
      },
      { status: 201 }
    );
  } catch (e) {
    console.error('Quick report failed:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : '報告書の作成に失敗しました' }, { status: 500 });
  }
}
