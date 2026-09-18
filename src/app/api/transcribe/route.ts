import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// Vercel Hobby plan: max 4.5MB body, 10s execution
// Increase body size limit for audio uploads
export const maxDuration = 30; // seconds (Pro plan allows up to 60)

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

    // Check file size (limit to 4MB to stay under Vercel's body limit)
    if (audioFile.size > 4 * 1024 * 1024) {
      return NextResponse.json(
        { error: "音声ファイルが大きすぎます。短めに録音してください。" },
        { status: 400 }
      );
    }

    const openai = new OpenAI({ apiKey });

    // Convert File to a proper File object that the OpenAI SDK can handle
    // in Vercel's serverless environment
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const file = new File([buffer], "recording.webm", {
      type: audioFile.type || "audio/webm",
    });

    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
      language: "ja",
      prompt:
        "建設現場の調査報告。板金、屋根、外壁、防水、コーキング、シーリング、ひび割れ、劣化、漏水、補修。",
    });

    return NextResponse.json({ text: transcription.text });
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
