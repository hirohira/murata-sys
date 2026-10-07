import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Report } from '@/types';
import { buildReportPptx } from '@/lib/report-pptx';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: report, error } = await supabase
      .from('reports')
      .select('*, project:projects(*)')
      .eq('id', params.id)
      .single();

    if (error || !report) {
      return NextResponse.json(
        { error: '報告書が見つかりません' },
        { status: 404 }
      );
    }

    let worker: string | null = null;
    if (report.created_by) {
      const { data: user } = await supabase.from('users').select('name').eq('id', report.created_by).single();
      worker = user?.name ?? null;
    }

    const pptxBuffer = await buildReportPptx(report as Report, { worker });

    return new NextResponse(pptxBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(report.title)}.pptx"`,
      },
    });
  } catch (err) {
    console.error('PPTX export error:', err);
    return NextResponse.json(
      { error: 'エクスポートに失敗しました' },
      { status: 500 }
    );
  }
}
