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
    const { project_id, report_type } = body;

    if (!project_id || !report_type) {
      return NextResponse.json(
        { error: '案件IDと報告書種別が必要です' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();

    // Fetch project info
    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('*')
      .eq('id', project_id)
      .single();

    if (projErr || !project) {
      return NextResponse.json(
        { error: '案件が見つかりません' },
        { status: 404 }
      );
    }

    // Fetch daily reports for this project
    const { data: dailyReports } = await supabase
      .from('daily_reports')
      .select('*')
      .eq('project_id', project_id)
      .order('report_date', { ascending: true });

    // Fetch photos for this project
    const { data: photos } = await supabase
      .from('report_photos')
      .select('*')
      .eq('project_id', project_id)
      .order('sort_order', { ascending: true });

    // Build prompt based on report type
    const anthropic = new Anthropic({ apiKey });

    const dailyReportsSummary = (dailyReports || [])
      .map((r) => `- ${r.report_date}（${r.weather}）作業員${r.workers_count}名: ${r.work_content}${r.safety_notes ? `【安全事項】${r.safety_notes}` : ''}`)
      .join('\n');

    const photosSummary = (photos || [])
      .map((p, i) => `写真${i + 1}: カテゴリ=${p.category}, キャプション=${p.caption || '(なし)'}`)
      .join('\n');

    let systemPrompt = '';
    let userPrompt = '';

    if (report_type === '調査報告書') {
      systemPrompt = `あなたは建設業（板金・屋根・外壁・防水工事）の調査報告書を作成する専門家です。
現場の調査データから、施主や建築関係者に提出する調査報告書を作成してください。`;

      userPrompt = `以下の現場情報と日報データから、調査報告書を作成してください。

【現場情報】
- 顧客名：${project.customer_name}
- 現場名：${project.site_name}
- 工事種別：${project.construction_type}
- 建物種別：${project.building_type}
- 住所：${project.address || '（未記入）'}
- 読み手：${project.audience_type}

【日報データ】
${dailyReportsSummary || '（日報なし）'}

【写真情報】
${photosSummary || '（写真なし）'}

以下のJSON形式で返してください：
{
  "title": "報告書タイトル",
  "summary": "調査概要（3〜5文程度）",
  "findings": [
    {
      "photoNumber": 1,
      "location": "調査箇所",
      "finding": "所見（専門的かつ簡潔に。劣化状態、原因推定、リスク評価を含む）",
      "severity": "要補修" | "経過観察" | "問題なし",
      "recommendation": "推奨される対応"
    }
  ],
  "recommendation": "総合的な推奨事項・対応案"
}

${project.audience_type === '一般施主向け' ? '一般の施主にもわかりやすい表現で書いてください。専門用語には補足を添えてください。' : '建築の専門家向けに、技術用語を適切に使い簡潔に記述してください。'}
JSON のみ返してください。`;
    } else {
      // 完了報告書
      systemPrompt = `あなたは建設業（板金・屋根・外壁・防水工事）の完了報告書を作成する専門家です。
工事完了後の報告書を作成してください。`;

      userPrompt = `以下の現場情報と日報データから、完了報告書を作成してください。

【現場情報】
- 顧客名：${project.customer_name}
- 現場名：${project.site_name}
- 工事種別：${project.construction_type}
- 建物種別：${project.building_type}
- 住所：${project.address || '（未記入）'}
- 読み手：${project.audience_type}

【日報データ（施工記録）】
${dailyReportsSummary || '（日報なし）'}

【写真情報】
${photosSummary || '（写真なし）'}

以下のJSON形式で返してください：
{
  "title": "完了報告書タイトル",
  "summary": "工事概要と完了報告（5〜8文程度。施工期間、施工内容の要約、使用した主な材料・工法を含む）",
  "findings": [
    {
      "photoNumber": 1,
      "location": "施工箇所",
      "finding": "施工内容と仕上がり状態の説明",
      "severity": "問題なし",
      "recommendation": "今後のメンテナンス推奨事項"
    }
  ],
  "recommendation": "総合的なメンテナンス計画・保証内容・注意事項"
}

${project.audience_type === '一般施主向け' ? '一般の施主にもわかりやすい表現で書いてください。' : '建築の専門家向けに、技術用語を適切に使い簡潔に記述してください。'}
JSON のみ返してください。`;
    }

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const responseText = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AIからの応答を解析できませんでした');
    }

    const reportData = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
      ...reportData,
      project_id,
      report_type,
      generated_by_ai: true,
    });
  } catch (err) {
    console.error('Report generation error:', err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : '報告書の生成に失敗しました',
      },
      { status: 500 }
    );
  }
}
