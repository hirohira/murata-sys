import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY が設定されていません" },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;

    if (!audioFile) {
      return NextResponse.json(
        { error: "音声ファイルがありません" },
        { status: 400 }
      );
    }

    if (audioFile.size > 2 * 1024 * 1024) {
      return NextResponse.json(
        { error: "音声ファイルが大きすぎます。短めに録音してください。" },
        { status: 400 }
      );
    }

    // Call OpenAI Whisper API directly with native fetch
    // (avoids node-fetch ECONNRESET issues in Vercel serverless)
    const openaiForm = new FormData();
    const arrayBuffer = await audioFile.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: "audio/webm" });
    openaiForm.append("file", blob, "recording.webm");
    openaiForm.append("model", "whisper-1");
    openaiForm.append("language", "ja");
    openaiForm.append(
      "prompt",
      "建設現場の調査報告。板金、屋根、外壁、防水、コーキング、シーリング、ひび割れ、劣化、漏水、補修。"
    );

    const openaiRes = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: openaiForm,
      }
    );

    if (!openaiRes.ok) {
      const errBody = await openaiRes.text();
      console.error("OpenAI API error:", openaiRes.status, errBody);
      return NextResponse.json(
        { error: `OpenAI APIエラー (${openaiRes.status})` },
        { status: 500 }
      );
    }

    const result = await openaiRes.json();
    return NextResponse.json({ text: result.text });
  } catch (err) {
    console.error("Transcription error:", err);
    const message =
      err instanceof Error ? err.message : "文字起こしに失敗しました";
    return NextResponse.json(
      { error: `文字起こしに失敗しました: ${message}` },
      { status: 500 }
    );
  }
}
