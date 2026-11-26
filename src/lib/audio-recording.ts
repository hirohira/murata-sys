/** この端末で録音できる音声の形式（iPhone の Safari は mp4、Android・PC の Chrome は webm） */
export function pickAudioMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/aac'];
  return candidates.find((t) => MediaRecorder.isTypeSupported?.(t));
}

export function audioFileName(type: string): string {
  return /mp4|m4a|aac/.test(type) ? 'recording.m4a' : 'recording.webm';
}

/** 音声を文字にする（/api/transcribe） */
export async function transcribeBlob(blob: Blob): Promise<string> {
  const form = new FormData();
  form.append('audio', blob, audioFileName(blob.type));
  const res = await fetch('/api/transcribe', { method: 'POST', body: form });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || '文字起こしに失敗しました');
  return String(json.text || '');
}
