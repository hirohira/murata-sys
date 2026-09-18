import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

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

    const openai = new OpenAI({ apiKey });

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "ja",
      prompt: "建設現場の調査報告。板金、屋根、外壁、防水、コーキング、シーリング、ひび割れ、劣化、漏水、補修。",
    });

    return NextResponse.json({ text: transcription.text });
  } catch (err) {
    console.error("Transcription error:", err);
    return NextResponse.json(
      { error: "文字起こしに失敗しました" },
      { status: 500 }
    );
  }
}
