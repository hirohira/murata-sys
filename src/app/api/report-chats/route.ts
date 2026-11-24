import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getCurrentUser, permissionError } from '@/lib/current-user';
import type { ReportType } from '@/types';

const TYPES: ReportType[] = ['調査報告書', '完了報告書'];

// GET /api/report-chats?projectId= — 案件のチャット（新しい順）
export async function GET(req: Request) {
  const me = await getCurrentUser();
  const denied = permissionError(me);
  if (denied) return denied;
  const projectId = new URL(req.url).searchParams.get('projectId');
  const supabase = createServerSupabaseClient();
  let q = supabase
    .from('report_chats')
    .select('id, project_id, report_type, messages, report_id, created_at, updated_at, project:projects(site_name)')
    .order('updated_at', { ascending: false })
    .limit(30);
  if (projectId) q = q.eq('project_id', projectId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // 一覧では投稿の中身は送らず、件数だけ
  const list = (data || []).map(({ messages, ...rest }) => {
    const ms = Array.isArray(messages) ? (messages as { kind: string; photos?: unknown[] }[]) : [];
    return {
      ...rest,
      message_count: ms.length,
      photo_count: ms.reduce((n, m) => n + (m.kind === 'photos' ? m.photos?.length || 0 : 0), 0),
    };
  });
  return NextResponse.json({ data: list });
}

// POST /api/report-chats — チャットを始める { project_id, report_type }
export async function POST(req: Request) {
  const me = await getCurrentUser();
  const denied = permissionError(me);
  if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as { project_id?: string; report_type?: ReportType };
  const supabase = createServerSupabaseClient();
  const { data: project } = await supabase.from('projects').select('id').eq('id', body.project_id ?? '').single();
  if (!project) return NextResponse.json({ error: '案件が見つかりません' }, { status: 404 });
  const { data, error } = await supabase
    .from('report_chats')
    .insert({
      project_id: project.id,
      report_type: body.report_type && TYPES.includes(body.report_type) ? body.report_type : '調査報告書',
      messages: [],
      created_by: me!.id,
    })
    .select('*')
    .single();
  if (error) {
    const hint = /report_chats/.test(error.message) ? '（データベースの更新 007 が必要です）' : '';
    return NextResponse.json({ error: `${error.message}${hint}` }, { status: 500 });
  }
  return NextResponse.json({ data }, { status: 201 });
}
