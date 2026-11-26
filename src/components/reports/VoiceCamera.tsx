'use client';

/**
 * 話しながら撮るカメラ（チャットで報告書）
 *
 * カメラとマイクを同時に起動し、シャッターを押すたびに「前のシャッターから今までに話した音声」を
 * その写真の解説として区切る（話してからシャッター）。
 * 最後のシャッターのあとに話した内容は、最後の写真の解説に足す。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { pickAudioMimeType } from '@/lib/audio-recording';

export interface VoiceShot {
  file: File;
  preview: string;
  audio: Blob | null; // この写真の解説の音声（短すぎる・無いときは null）
}

const MAX_SHOT_EDGE = 2400;
const MIN_SPEECH_MS = 800; // これより短い音声は解説にしない

interface Props {
  sectionLabel: string;
  onFinish: (shots: VoiceShot[], trailingAudio: Blob | null) => void;
  onClose: () => void;
}

export default function VoiceCamera({ sectionLabel, onFinish, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // 録音の区切りごとに、録音機と音声のかけらを別々に持つ（前の区切りの音声が次に混ざらないように）
  const segRef = useRef<{ rec: MediaRecorder; chunks: Blob[]; start: number } | null>(null);
  const segStartRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [shots, setShots] = useState<VoiceShot[]>([]);
  const shotsRef = useRef<VoiceShot[]>([]);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [micOk, setMicOk] = useState(true);

  const stopAll = useCallback(() => {
    try {
      if (segRef.current && segRef.current.rec.state !== 'inactive') segRef.current.rec.stop();
    } catch {
      /* 何もしない */
    }
    segRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // ── 音声の区切り ──
  const startSegment = useCallback(() => {
    const stream = streamRef.current;
    const audioTracks = stream?.getAudioTracks() ?? [];
    if (!stream || audioTracks.length === 0) return;
    try {
      const type = pickAudioMimeType();
      const rec = new MediaRecorder(new MediaStream(audioTracks), type ? { mimeType: type, audioBitsPerSecond: 32000 } : undefined);
      const seg = { rec, chunks: [] as Blob[], start: Date.now() };
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) seg.chunks.push(e.data);
      };
      rec.start(500);
      segRef.current = seg;
      segStartRef.current = seg.start;
      setSeconds(0);
    } catch {
      setMicOk(false);
    }
  }, []);

  /** いまの区切りを止めて、その音声を返す */
  const stopSegment = useCallback((): Promise<Blob | null> => {
    const seg = segRef.current;
    segRef.current = null;
    if (!seg || seg.rec.state === 'inactive') return Promise.resolve(null);
    const { rec } = seg;
    const duration = Date.now() - seg.start;
    return new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        const blob = seg.chunks.length ? new Blob(seg.chunks, { type: rec.mimeType || 'audio/webm' }) : null;
        resolve(duration >= MIN_SPEECH_MS ? blob : null);
      };
      rec.onstop = done;
      try {
        rec.stop();
      } catch {
        resolve(null);
      }
      // 端末によって onstop が来ないことがあるので待ちすぎない
      setTimeout(done, 1500);
    });
  }, []);

  // ── 起動 ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('このブラウザではカメラを使えません。Safari（iPhone）またはChrome（Android）で開いてください。');
        return;
      }
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 4096 }, height: { ideal: 3072 } },
            audio: { echoCancellation: true, noiseSuppression: true },
          });
        } catch (e) {
          // マイクだけ許可されないときは、カメラだけで撮れるようにする
          if ((e as { name?: string })?.name === 'NotAllowedError') throw e;
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
          setMicOk(false);
        }
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (stream.getAudioTracks().length === 0) setMicOk(false);
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        startSegment();
        setReady(true);
      } catch (e) {
        const name = (e as { name?: string })?.name;
        setError(
          name === 'NotAllowedError'
            ? 'カメラとマイクの使用が許可されていません。ブラウザの設定で、このサイトのカメラとマイクを「許可」にしてください。'
            : 'カメラを起動できませんでした。'
        );
      }
    })();
    const onHide = () => stopAll();
    window.addEventListener('pagehide', onHide);
    return () => {
      cancelled = true;
      window.removeEventListener('pagehide', onHide);
      stopAll();
    };
  }, [startSegment, stopAll]);

  // 録音中の秒数
  useEffect(() => {
    if (!ready) return;
    const t = setInterval(() => setSeconds(Math.floor((Date.now() - segStartRef.current) / 1000)), 500);
    return () => clearInterval(t);
  }, [ready]);

  const grabFrame = async (): Promise<Blob | null> => {
    const video = videoRef.current;
    if (!video) return null;
    for (let i = 0; i < 15 && (!video.videoWidth || video.readyState < 2); i++) {
      await new Promise((r) => setTimeout(r, 100));
    }
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;
    const scale = Math.min(1, MAX_SHOT_EDGE / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9));
  };

  const shoot = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setFlash(true);
    setTimeout(() => setFlash(false), 120);
    try {
      const blob = await grabFrame();
      // シャッターまでに話した内容がこの写真の解説（すぐ次の区切りを始める）
      const audio = await stopSegment();
      startSegment();
      if (!blob) throw new Error('画像を取り込めませんでした');
      const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
      const shot = { file, preview: URL.createObjectURL(blob), audio };
      shotsRef.current = [...shotsRef.current, shot];
      setShots(shotsRef.current);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '撮影できませんでした');
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    setBusy(true);
    const trailing = await stopSegment();
    stopAll();
    onFinish(shotsRef.current, trailing);
  };

  const cancel = () => {
    stopAll();
    shotsRef.current.forEach((s) => URL.revokeObjectURL(s.preview));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white" role="dialog" aria-label="話しながら撮る">
      <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-[max(12px,env(safe-area-inset-top))]">
        <button type="button" onClick={cancel} className="min-h-[40px] text-sm text-gray-300">
          やめる
        </button>
        <div className="min-w-0 text-center">
          <p className="truncate text-sm font-bold">{sectionLabel}</p>
          <p className="text-[11px] text-gray-300">
            {micOk ? (
              <>
                <span className="mr-1 inline-block h-2 w-2 animate-pulse rounded-full bg-red-500 align-middle" />
                録音中 {seconds}秒
              </>
            ) : (
              'マイクが使えないため、解説なしで撮ります'
            )}
          </p>
        </div>
        <span className="min-w-[48px] text-right text-sm tabular-nums">{shots.length}枚</span>
      </div>

      <div className="relative min-h-0 flex-1">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        {flash && <div className="absolute inset-0 bg-white/70" />}
        {ready && (
          <p className="absolute inset-x-4 top-3 rounded-lg bg-black/55 px-3 py-2 text-center text-[13px] leading-snug">
            写真の説明を話してから、シャッターを押してください
          </p>
        )}
        {error && <p className="absolute inset-x-4 bottom-3 rounded-lg bg-red-600/90 px-3 py-2 text-sm">{error}</p>}
      </div>

      {shots.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto px-3 pt-2">
          {shots.map((s, i) => (
            <div key={s.preview} className="relative h-14 w-[74px] flex-shrink-0 overflow-hidden rounded">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.preview} alt={`${i + 1}枚目`} className="h-full w-full object-cover" />
              <span className="absolute left-0.5 top-0.5 rounded bg-black/60 px-1 text-[10px] font-bold">{i + 1}</span>
              {s.audio && <span className="absolute bottom-0.5 right-0.5 rounded bg-red-600 px-1 text-[9px] font-bold">解説</span>}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between px-6 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
        <span className="w-20" />
        <button
          type="button"
          onClick={() => void shoot()}
          disabled={!ready || busy}
          aria-label="シャッター"
          className="h-[72px] w-[72px] touch-manipulation rounded-full border-4 border-white bg-white/20 active:bg-white/60 disabled:opacity-40"
        />
        <button
          type="button"
          onClick={() => void finish()}
          disabled={busy || shots.length === 0}
          className="min-h-[44px] w-20 touch-manipulation rounded-full bg-murata-primary text-sm font-bold disabled:opacity-40"
        >
          終了
        </button>
      </div>
    </div>
  );
}
