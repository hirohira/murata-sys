/** この端末で録音できる音声の形式（iPhone の Safari は mp4、Android・PC の Chrome は webm） */
export function pickAudioMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  // iPhone・Mac の Safari は mp4 を優先（Safari の webm 録音は OpenAI で読めないことがある）
  const isSafari = typeof navigator !== 'undefined' && /Safari/.test(navigator.userAgent) && !/Chrome|CriOS|Android/.test(navigator.userAgent);
  const webm = ['audio/webm;codecs=opus', 'audio/webm'];
  const mp4 = ['audio/mp4', 'audio/mp4;codecs=mp4a.40.2', 'audio/aac'];
  const candidates = isSafari ? [...mp4, ...webm] : [...webm, ...mp4];
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
