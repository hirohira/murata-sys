import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY が設定されていません' },
        { status: 500 }
      );
    }

    const body = await req.json();
    const {
      project_id,
      report_type,
      chapter_key,
      chapter_title,
      photo_captions,
      audience_type,
    } = body;

    if (!project_id || !chapter_key) {
      return NextResponse.json(
        { error: '案件IDと章キーが必要です' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();

    // Fetch project info
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', project_id)
      .single();

    if (!project) {
      return NextResponse.json(
        { error: '案件が見つかりません' },
        { status: 404 }
      );
    }

    const anthropic = new Anthropic({ apiKey });

    const isInspection = report_type === '調査報告書';

    const STORY = '報告書は「建物・現場全体の把握 → 対象部位・不具合状況 → 原因の特定 → 必要な対策 → 修繕・工事提案」という顧客目線のストーリーで構成されます。担当する章がこの流れのどこにあたるかを意識し、前後の章と重複しない内容にしてください。';
    const CATEGORY_GUIDE: Record<string, string> = {
      '住宅': '建物カテゴリーは住宅です。住まい手の暮らし・安心・美観への影響を、生活者の目線で説明してください。',
      '工場': '建物カテゴリーは工場です。操業・生産設備・従業員の安全への影響と、操業を止めない工事計画を意識して説明してください。',
      '店舗': '建物カテゴリーは店舗です。営業・来店客・店舗の印象（美観）への影響と、営業時間に配慮した工事計画を意識して説明してください。',
    };

    const systemPrompt = `あなたは株式会社MURATA（板金・屋根・外壁・防水工事）の${isInspection ? '調査報告書' : '完了報告書'}を作成する担当者です。
報告書の各章の説明文を、写真キャプションと現場情報から専門的かつ簡潔に作成してください。
${STORY}
${CATEGORY_GUIDE[project.building_type] ?? ''}`;

    const captionsText = (photo_captions || []).length > 0
      ? `\n写真キャプション:\n${photo_captions.map((c: string, i: number) => `${i + 1}. ${c}`).join('\n')}`
      : '（写真キャプションなし）';

    const userPrompt = `以下の情報から「${chapter_title}」の章の説明文を生成してください。

【現場情報】
- 顧客名：${project.customer_name}
- 現場名：${project.site_name}
- 工事種別：${project.construction_type}
- 建物種別：${project.building_type}

【章】${chapter_title}（キー: ${chapter_key}）
${captionsText}

${audience_type === '一般施主向け' ? '一般の施主にもわかりやすい表現で書いてください。専門用語には補足を添えてください。' : '建築の専門家向けに、技術用語を適切に使い簡潔に記述してください。'}

3〜5文程度で、この章に適した説明文のみを返してください。JSON等は不要です。`;

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const description = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    return NextResponse.json({ description: description.trim() });
  } catch (err) {
    console.error('Chapter generation error:', err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : '章の生成に失敗しました',
      },
      { status: 500 }
    );
  }
}
