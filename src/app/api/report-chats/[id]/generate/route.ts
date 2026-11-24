import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getCurrentUser, permissionError } from '@/lib/current-user';
import { parseChat, sanitizeMessages } from '@/lib/report-chat';
import { buildChatChapters, planChatReport } from '@/lib/report-chat-generate';
import type { Project, ReportType } from '@/types';

export const maxDuration = 60;

// POST /api/report-chats/[id]/generate — 投稿から報告書（下書き）を作る
// 作った報告書の PowerPoint は、画面から /api/reports/[id]/drive を呼んでドライブに保存する
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  const denied = permissionError(me);
  if (denied) return denied;

  const supabase = createServerSupabaseClient();
  const { data: chat } = await supabase.from('report_chats').select('*').eq('id', params.id).single();
  if (!chat) return NextResponse.json({ error: 'チャットが見つかりません' }, { status: 404 });
  const { data: project } = await supabase.from('projects').select('*').eq('id', chat.project_id).single();
  if (!project) return NextResponse.json({ error: '案件が見つかりません' }, { status: 404 });
  const p = project as Project;

  // 報告書に使う写真は、この案件の保存先（report-photos）にあるものだけ
  const storagePrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/report-photos/`;
  const messages = (sanitizeMessages(chat.messages) || []).map((m) =>
    m.kind === 'photos' ? { ...m, photos: m.photos.filter((ph) => ph.url.startsWith(storagePrefix)) } : m
  );
  const parsed = parseChat(messages);
  if (parsed.sections.length === 0) {
    return NextResponse.json({ error: '区分ボタンを押して、写真かコメントを投稿してください' }, { status: 400 });
  }

  const reportType = chat.report_type as ReportType;
  const { plan, ai, aiError } = await planChatReport(parsed, p, reportType);
  const chapters = buildChatChapters(parsed, plan, reportType, p);
  const firstAt = messages[0]?.at ? new Date(messages[0].at) : new Date();
  const surveyDate = new Date(firstAt.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);

  const { data: report, error } = await supabase
    .from('reports')
    .insert({
      project_id: p.id,
      report_type: reportType,
      title: `${plan.construction_name} ${reportType}`,
      summary:
        chapters
          .filter((c) => c.description)
          .map((c) => `【${c.title}】${c.description}`)
          .join('\n\n')
          .slice(0, 4000) || null,
      findings: [],
      chapters,
      meta: {
        input_pattern: 'onsite',
        report_style: '調査報告書様式',
        survey_date: surveyDate,
        addressee: `${p.customer_name}　様`,
        construction_name: plan.construction_name,
        staff_name: me!.profile.name,
      },
      generated_by_ai: ai,
      status: '下書き',
      created_by: me!.id,
    })
    .select('id')
    .single();
  if (error || !report) {
    return NextResponse.json({ error: error?.message || '報告書を保存できませんでした' }, { status: 500 });
  }
  await supabase.from('report_chats').update({ report_id: report.id }).eq('id', chat.id);

  return NextResponse.json(
    {
      data: {
        id: report.id,
        pages: chapters.filter((c) => c.key.startsWith('chat_')).length,
        photos: parsed.photoCount,
        ai,
        aiError: aiError ?? null,
      },
    },
    { status: 201 }
  );
}
