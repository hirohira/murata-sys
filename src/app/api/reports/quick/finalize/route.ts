import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getCurrentUser, permissionError } from '@/lib/current-user';
import { buildChapters, type AiResult, type SourcePhoto } from '@/lib/quick-report';
import type { Project, ReportType } from '@/types';

const TYPES: ReportType[] = ['調査報告書', '完了報告書'];

// POST /api/reports/quick/finalize — 手順3：AIの案と取り込んだ写真の場所から報告書を保存する
// body: { project_id, report_type, scenario, plan, photos: SourcePhoto（url・path 付き）[] }
export async function POST(req: Request) {
  const me = await getCurrentUser();
  const denied = permissionError(me);
  if (denied) return denied;

  const body = (await req.json()) as {
    project_id?: string;
    report_type?: ReportType;
    scenario?: string;
    plan?: AiResult;
    photos?: SourcePhoto[];
  };
  if (!body.plan || !Array.isArray(body.plan.chapters)) {
    return NextResponse.json({ error: '報告書の内容がありません' }, { status: 400 });
  }
  const reportType = body.report_type && TYPES.includes(body.report_type) ? body.report_type : '調査報告書';
  const supabase = createServerSupabaseClient();
  const { data: project } = await supabase.from('projects').select('*').eq('id', body.project_id ?? '').single();
  if (!project) return NextResponse.json({ error: '案件が見つかりません' }, { status: 404 });
  const p = project as Project;

  // 写真の場所は、この案件の保存先（report-photos）にあるものだけ受け付ける
  const storagePrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/report-photos/`;
  const photos = (body.photos || []).filter(
    (ph) => typeof ph.key === 'string' && typeof ph.url === 'string' && ph.url.startsWith(storagePrefix) && typeof ph.path === 'string'
  );
  const byKey = new Map(photos.map((ph) => [ph.key, ph]));

  const { chapters, usedPhotos, failedPhotos } = buildChapters({
    project: p,
    reportType,
    plan: body.plan,
    photos: body.photos || [],
    resolve: (key) => {
      const ph = byKey.get(key);
      return ph ? { url: ph.url!, path: ph.path! } : null;
    },
  });

  const constructionName = body.plan.construction_name?.trim() || p.site_name;
  const { data: report, error } = await supabase
    .from('reports')
    .insert({
      project_id: p.id,
      report_type: reportType,
      title: `${constructionName} ${reportType}`,
      summary: (body.scenario || '').slice(0, 4000) || null,
      findings: [],
      chapters,
      meta: {
        input_pattern: 'office',
        survey_date: new Date().toISOString().slice(0, 10),
        addressee: `${p.customer_name}　様`,
        construction_name: constructionName,
        purpose: body.plan.purpose?.trim() || '',
        staff_name: me!.profile.name,
      },
      generated_by_ai: true,
      status: '下書き',
      created_by: me!.id,
    })
    .select('id')
    .single();
  if (error || !report) {
    return NextResponse.json({ error: error?.message || '報告書を保存できませんでした' }, { status: 500 });
  }

  return NextResponse.json(
    {
      data: {
        id: report.id,
        chapters: chapters.filter((c) => !['cover', 'schedule', 'company'].includes(c.key)).length,
        photosUsed: usedPhotos,
        photosFailed: failedPhotos,
      },
    },
    { status: 201 }
  );
}
