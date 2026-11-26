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
    // 音声の形式は、ファイルの種類の表示ではなく中身の先頭から判定する
    // （iPhone は種類の表示が空だったり、実際と違ったりすることがあり、拡張子が合わないと OpenAI が 400 を返す）
    const ext = sniffAudioExt(new Uint8Array(arrayBuffer)) ?? extFromType(audioFile.type || "");
    if (!ext) {
      return NextResponse.json(
        { error: `この音声の形式には対応していません（${audioFile.type || "不明"}）` },
        { status: 400 }
      );
    }
    const blob = new Blob([arrayBuffer], { type: MIME[ext] });
    openaiForm.append("file", blob, `recording.${ext}`);
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
      // OpenAI の説明（例：Audio file is too short）も返して、原因が画面で分かるようにする
      let detail = "";
      try {
        detail = String(JSON.parse(errBody)?.error?.message || "").slice(0, 120);
      } catch {
        detail = "";
      }
      return NextResponse.json(
        { error: `OpenAI APIエラー (${openaiRes.status})${detail ? `：${detail}` : ""}` },
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

const MIME: Record<string, string> = {
  m4a: "audio/mp4",
  webm: "audio/webm",
  ogg: "audio/ogg",
  wav: "audio/wav",
  mp3: "audio/mpeg",
};

/** ファイルの先頭のバイト列から音声の形式を判定する */
function sniffAudioExt(b: Uint8Array): string | null {
  if (b.length < 12) return null;
  const ascii = (from: number, len: number) => String.fromCharCode(...Array.from(b.subarray(from, from + len)));
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "webm";
  if (ascii(4, 4) === "ftyp") return "m4a";
  if (ascii(0, 4) === "OggS") return "ogg";
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WAVE") return "wav";
  if (ascii(0, 3) === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return "mp3";
  return null;
}

function extFromType(type: string): string | null {
  if (/mp4|m4a|aac/.test(type)) return "m4a";
  if (/webm/.test(type)) return "webm";
  if (/ogg/.test(type)) return "ogg";
  if (/wav/.test(type)) return "wav";
  if (/mpeg|mp3/.test(type)) return "mp3";
  return null;
}
