import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

interface PhotoInput {
  id: string;
  base64: string;
  mimeType: string;
  description: string;
  location: string;
  fileName: string;
}

interface RequestBody {
  siteName: string;
  buildingName: string;
  inspectionDate: string;
  photos: PhotoInput[];
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY が設定されていません" },
        { status: 500 }
      );
    }

    const body: RequestBody = await req.json();
    const { siteName, buildingName, inspectionDate, photos } = body;

    if (!photos || photos.length === 0) {
      return NextResponse.json(
        { error: "写真が必要です" },
        { status: 400 }
      );
    }

    const anthropic = new Anthropic({ apiKey });

    // Build content blocks with images and descriptions
    const contentBlocks: Anthropic.MessageCreateParams["messages"][0]["content"] = [];

    contentBlocks.push({
      type: "text" as const,
      text: `あなたは建設業（板金・屋根・外壁・防水工事）の調査報告書を作成する専門家です。
以下の現場写真と所見メモから、調査報告書の「状況写真・所見」ページを作成してください。

【現場情報】
- 現場名：${siteName}
- 建物名：${buildingName || "（未記入）"}
- 調査日：${inspectionDate}

各写真について、以下の形式でJSON配列を返してください：
{
  "findings": [
    {
      "photoId": "写真のID",
      "photoNumber": 1,
      "location": "撮影箇所",
      "finding": "所見（専門的かつ簡潔に。劣化状態、原因推定、リスク評価を含む）",
      "severity": "要補修" | "経過観察" | "問題なし",
      "recommendation": "推奨される対応"
    }
  ],
  "summary": "調査全体の総括（3〜5文程度）"
}

所見メモが空の写真は、写真の内容から推測して所見を作成してください。
建設現場の専門用語を適切に使い、報告書にふさわしい文体で書いてください。
JSON のみ返してください。`,
    });

    for (const photo of photos) {
      contentBlocks.push({
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: photo.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
          data: photo.base64,
        },
      });
      contentBlocks.push({
        type: "text" as const,
        text: `[写真ID: ${photo.id}] 撮影箇所: ${photo.location || "（未記入）"} / 所見メモ: ${photo.description || "（音声・テキスト入力なし）"}`,
      });
    }

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [{ role: "user", content: contentBlocks }],
    });

    // Extract text from response
    const responseText = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("AIからの応答を解析できませんでした");
    }

    const reportData = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
      ...reportData,
      siteName,
      buildingName,
      inspectionDate,
    });
  } catch (err) {
    console.error("Report generation error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "報告書の生成に失敗しました",
      },
      { status: 500 }
    );
  }
}
