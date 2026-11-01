'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CAPTURE_METHODS, PHOTO_CATEGORIES, PHOTO_CATEGORY_STYLE } from '@/lib/constants';
import { resizeForUpload } from '@/lib/compress-photo';
import type { CaptureMethod, PhotoCategory, Project, ReportPhoto } from '@/types';

interface Props {
  project: Project;
}

/** アップ待ち・アップ中・失敗した写真（端末側だけで持つ） */
interface PendingItem {
  key: string;
  blob: Blob;
  preview: string;
  category: PhotoCategory;
  method: CaptureMethod;
  takenAt: string | null;
  status: 'waiting' | 'uploading' | 'error';
  error?: string;
}

const CONCURRENCY = 2;

export default function ProjectPhotos({ project }: Props) {
  const [photos, setPhotos] = useState<ReportPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [mode, setMode] = useState<CaptureMethod>('camera');
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [driveErrors, setDriveErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const queueRunning = useRef(0);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/projects/${project.id}/photos`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || '写真を読み込めませんでした');
        setPhotos(json.data || []);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : '写真を読み込めませんでした');
      } finally {
        setLoading(false);
      }
    })();
  }, [project.id]);

  // ── アップの待ち行列 ──
  const pendingRef = useRef<PendingItem[]>([]);
  pendingRef.current = pending;

  const uploadOne = useCallback(
    async (item: PendingItem) => {
      setPending((prev) => prev.map((p) => (p.key === item.key ? { ...p, status: 'uploading', error: undefined } : p)));
      try {
        const { blob, width, height } = await resizeForUpload(item.blob);
        const form = new FormData();
        form.append('file', blob, 'photo.jpg');
        form.append('category', item.category);
        form.append('method', item.method);
        if (item.takenAt) form.append('taken_at', item.takenAt);
        form.append('width', String(width));
        form.append('height', String(height));
        const res = await fetch(`/api/projects/${project.id}/photos`, { method: 'POST', body: form });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || `アップに失敗しました（${res.status}）`);
        const saved = json.data as ReportPhoto;
        setPhotos((prev) => [saved, ...prev]);
        if (json.driveError) setDriveErrors((prev) => ({ ...prev, [saved.id]: json.driveError }));
        setPending((prev) => prev.filter((p) => p.key !== item.key));
        URL.revokeObjectURL(item.preview);
      } catch (e) {
        setPending((prev) =>
          prev.map((p) =>
            p.key === item.key ? { ...p, status: 'error', error: e instanceof Error ? e.message : 'アップに失敗しました' } : p
          )
        );
      }
    },
    [project.id]
  );

  const pump = useCallback(() => {
    while (queueRunning.current < CONCURRENCY) {
      const next = pendingRef.current.find((p) => p.status === 'waiting');
      if (!next) return;
      // 二重に拾わないよう、ここで状態を先に進める
      pendingRef.current = pendingRef.current.map((p) => (p.key === next.key ? { ...p, status: 'uploading' } : p));
      queueRunning.current++;
      uploadOne(next).finally(() => {
        queueRunning.current--;
        pump();
      });
    }
  }, [uploadOne]);

  useEffect(() => {
    if (pending.some((p) => p.status === 'waiting')) pump();
  }, [pending, pump]);

  const enqueue = useCallback((blobs: { blob: Blob; takenAt: string | null }[], category: PhotoCategory, method: CaptureMethod) => {
    const items: PendingItem[] = blobs.map(({ blob, takenAt }) => ({
      key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      blob,
      preview: URL.createObjectURL(blob),
      category,
      method,
      takenAt,
      status: 'waiting',
    }));
    setPending((prev) => [...prev, ...items]);
  }, []);

  const retryPending = (key: string) =>
    setPending((prev) => prev.map((p) => (p.key === key ? { ...p, status: 'waiting', error: undefined } : p)));

  const discardPending = (key: string) =>
    setPending((prev) => {
      const target = prev.find((p) => p.key === key);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((p) => p.key !== key);
    });

  // ── アップ済み写真の操作 ──
  const changeCategory = async (photo: ReportPhoto, category: PhotoCategory) => {
    if (photo.category === category) return;
    const before = photo.category;
    setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, category } : p)));
    try {
      const res = await fetch(`/api/photos/${photo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '区分を変更できませんでした');
      setPhotos((prev) => prev.map((p) => (p.id === photo.id ? json.data : p)));
      if (json.driveError) setDriveErrors((prev) => ({ ...prev, [photo.id]: json.driveError }));
    } catch (e) {
      setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, category: before } : p)));
      setNotice(e instanceof Error ? e.message : '区分を変更できませんでした');
    }
  };

  const retryDrive = async (photo: ReportPhoto) => {
    setDriveErrors((prev) => ({ ...prev, [photo.id]: '再送中…' }));
    try {
      const res = await fetch(`/api/photos/${photo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retryDrive: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '再送に失敗しました');
      setPhotos((prev) => prev.map((p) => (p.id === photo.id ? json.data : p)));
      setDriveErrors((prev) => {
        const next = { ...prev };
        if (json.driveError) next[photo.id] = json.driveError;
        else delete next[photo.id];
        return next;
      });
    } catch (e) {
      setDriveErrors((prev) => ({ ...prev, [photo.id]: e instanceof Error ? e.message : '再送に失敗しました' }));
    }
  };

  const removePhoto = async (photo: ReportPhoto) => {
    if (!window.confirm('この写真を削除しますか？（ドライブのファイルはゴミ箱に移ります）')) return;
    try {
      const res = await fetch(`/api/photos/${photo.id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || '削除できませんでした');
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    } catch (e) {
      setNotice(e instanceof Error ? e.message : '削除できませんでした');
    }
  };

  // ── 集計 ──
  const methodCounts = useMemo(() => {
    const counts: Record<string, number> = { camera: 0, select: 0, inapp: 0, other: 0 };
    photos.forEach((p) => {
      const k = p.capture_method && counts[p.capture_method] !== undefined ? p.capture_method : 'other';
      counts[k]++;
    });
    return counts;
  }, [photos]);

  const uploadingCount = pending.filter((p) => p.status !== 'error').length;
  const failedCount = pending.filter((p) => p.status === 'error').length;

  return (
    <div className="space-y-5">
      {/* 撮り方の切り替え */}
      <div className="card">
        <div className="card-body space-y-4">
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1" role="tablist" aria-label="写真の撮り方">
            {CAPTURE_METHODS.map((m) => (
              <button
                key={m.key}
                type="button"
                role="tab"
                aria-selected={mode === m.key}
                onClick={() => setMode(m.key)}
                className={`rounded-lg px-2 py-2 text-xs sm:text-sm font-medium transition-colors ${
                  mode === m.key ? 'bg-white text-murata-primary shadow-sm' : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500">{CAPTURE_METHODS.find((m) => m.key === mode)?.description}</p>

          {mode === 'camera' && <CameraButtons onCaptured={(file, cat) => enqueue([{ blob: file, takenAt: new Date().toISOString() }], cat, 'camera')} />}
          {mode === 'select' && (
            <MultiSelect
              onSelected={(files, cat) =>
                enqueue(
                  files.map((f) => ({ blob: f, takenAt: f.lastModified ? new Date(f.lastModified).toISOString() : null })),
                  cat,
                  'select'
                )
              }
            />
          )}
          {mode === 'inapp' && (
            <InAppCamera onShot={(blob, cat) => enqueue([{ blob, takenAt: new Date().toISOString() }], cat, 'inapp')} />
          )}

          {(uploadingCount > 0 || failedCount > 0) && (
            <p className="text-sm text-gray-700" aria-live="polite">
              {uploadingCount > 0 && <>アップ中 {uploadingCount}枚　</>}
              {failedCount > 0 && <span className="text-red-600">失敗 {failedCount}枚（下の写真の「再試行」を押してください）</span>}
            </p>
          )}
          {project.drive_folder_id ? (
            <p className="text-xs text-gray-500">
              写真は現場フォルダの「03_現場調査」内に、区分ごとのフォルダで保存されます。
            </p>
          ) : (
            <p className="text-xs text-gray-500">
              現場フォルダが未作成の場合は、最初の写真をアップしたときに自動で作成されます。
            </p>
          )}
        </div>
      </div>

      {notice && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} className="text-red-500 hover:text-red-700" aria-label="閉じる">
            ×
          </button>
        </div>
      )}

      {/* 一覧 */}
      <div className="card">
        <div className="card-header flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold text-sm">アップした写真（{photos.length}枚）</h3>
          <p className="text-xs text-gray-500">
            撮り方別：
            {CAPTURE_METHODS.map((m) => `${m.label} ${methodCounts[m.key]}枚`).join('・')}
            {methodCounts.other > 0 && `・日報など ${methodCounts.other}枚`}
          </p>
        </div>
        <div className="card-body space-y-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin w-6 h-6 border-2 border-murata-primary border-t-transparent rounded-full" />
            </div>
          ) : loadError ? (
            <p className="text-sm text-red-600">{loadError}</p>
          ) : photos.length === 0 && pending.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">
              まだ写真はありません。上の操作で撮影・選択すると、ここに区分ごとに並びます。
            </p>
          ) : (
            PHOTO_CATEGORIES.map((cat) => {
              const list = photos.filter((p) => p.category === cat);
              const waiting = pending.filter((p) => p.category === cat);
              if (list.length === 0 && waiting.length === 0) return null;
              const style = PHOTO_CATEGORY_STYLE[cat];
              return (
                <section key={cat}>
                  <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-800">
                    <span className="rounded px-2 py-0.5 text-xs text-white" style={{ background: style.color }}>
                      {cat}
                    </span>
                    {list.length + waiting.length}枚
                  </h4>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {waiting.map((p) => (
                      <PendingThumb
                        key={p.key}
                        item={p}
                        onRetry={() => retryPending(p.key)}
                        onDiscard={() => discardPending(p.key)}
                      />
                    ))}
                    {list.map((p) => (
                      <PhotoThumb
                        key={p.id}
                        photo={p}
                        driveError={driveErrors[p.id]}
                        onChangeCategory={(c) => changeCategory(p, c)}
                        onRetryDrive={() => retryDrive(p)}
                        onDelete={() => removePhoto(p)}
                      />
                    ))}
                  </div>
                </section>
              );
            })
          )}
          {photos.length > 0 && (
            <p className="text-xs text-gray-500">
              区分を間違えたときは、写真の下の区分を選び直すと、ドライブのフォルダとファイル名も変わります。
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 方式1：区分のボタン → スマホのカメラ（1枚） ───
function CameraButtons({ onCaptured }: { onCaptured: (file: File, category: PhotoCategory) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCat = useRef<PhotoCategory | null>(null);

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {PHOTO_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => {
              pendingCat.current = cat;
              if (inputRef.current) {
                inputRef.current.value = '';
                inputRef.current.click();
              }
            }}
            className="flex flex-col items-start rounded-xl px-4 py-4 text-left text-white shadow-sm transition-transform active:scale-[0.98]"
            style={{ background: PHOTO_CATEGORY_STYLE[cat].color }}
          >
            <span className="text-base font-bold">{cat}を撮影</span>
            <span className="text-xs opacity-90">{PHOTO_CATEGORY_STYLE[cat].hint}</span>
          </button>
        ))}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && pendingCat.current) onCaptured(f, pendingCat.current);
          pendingCat.current = null;
        }}
      />
      <p className="mt-3 text-xs text-gray-500">
        1回押すごとに1枚撮影します。撮影後はすぐにアップが始まるので、続けて次の区分を押せます。
      </p>
    </div>
  );
}

// ─── 区分の選択（セグメント） ───
function CategorySegment({ value, onChange }: { value: PhotoCategory; onChange: (c: PhotoCategory) => void }) {
  return (
    <div className="grid grid-cols-4 gap-1" role="radiogroup" aria-label="区分">
      {PHOTO_CATEGORIES.map((cat) => {
        const on = cat === value;
        return (
          <button
            key={cat}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(cat)}
            className={`rounded-lg border px-1 py-2.5 text-sm font-semibold transition-colors ${
              on ? 'border-transparent text-white' : 'border-gray-300 bg-white text-gray-700'
            }`}
            style={on ? { background: PHOTO_CATEGORY_STYLE[cat].color } : undefined}
          >
            {cat}
          </button>
        );
      })}
    </div>
  );
}

function hms(d: Date) {
  return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ─── 方式2：撮っておいた写真を、区分を選んでまとめて選択 ───
function MultiSelect({ onSelected }: { onSelected: (files: File[], category: PhotoCategory) => void }) {
  const [category, setCategory] = useState<PhotoCategory>('現状');
  const [sessionStart, setSessionStart] = useState<number | null>(null);
  const [result, setResult] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-xs font-medium text-gray-600">① これから選ぶ写真の区分</p>
        <CategorySegment value={category} onChange={setCategory} />
      </div>
      <label className="flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2.5 text-sm text-gray-700">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={sessionStart !== null}
          onChange={(e) => setSessionStart(e.target.checked ? Date.now() : null)}
        />
        <span>
          撮影を始める前にチェック（チェック以降に撮った写真だけを取り込みます）
          <span className="block text-xs text-gray-500">
            {sessionStart ? `チェックした時刻：${hms(new Date(sessionStart))}` : '未チェックなら選んだ写真をすべて取り込みます'}
          </span>
        </span>
      </label>
      <button
        type="button"
        onClick={() => {
          if (inputRef.current) {
            inputRef.current.value = '';
            inputRef.current.click();
          }
        }}
        className="btn btn-primary w-full py-3"
      >
        ② 写真をまとめて選ぶ（{category}）
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          const accepted: File[] = [];
          let skipped = 0;
          files.forEach((f) => {
            if (sessionStart && f.lastModified && f.lastModified < sessionStart - 60 * 1000) skipped++;
            else accepted.push(f);
          });
          if (accepted.length) onSelected(accepted, category);
          let msg = `${accepted.length}枚を「${category}」でアップします。`;
          if (skipped) msg += `チェックより前に撮った${skipped}枚は取り込みませんでした。`;
          setResult(files.length ? msg : '');
        }}
      />
      {result && (
        <p className="text-sm text-gray-700" aria-live="polite">
          {result}
        </p>
      )}
      <p className="text-xs text-gray-500">
        スマホのカメラで続けて撮影したあと、区分ごとに選んでアップします。区分ごとに②を繰り返してください。
      </p>
    </div>
  );
}

// ─── 方式3：アプリ内カメラで区分を切り替えながら連続撮影 ───
interface CameraCaps {
  torch?: boolean;
  zoom?: { min: number; max: number; step?: number };
}

function cameraHelp(errName: string | undefined): string[] {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIOS =
    /iPhone|iPad|iPod/.test(ua) ||
    (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const inApp = /Line\/|FBAN|FBAV|Instagram|GSA\/|YJApp|Twitter/i.test(ua);
  const iosChrome = isIOS && /CriOS/.test(ua);
  if (inApp) {
    return [
      'LINEなどのアプリの中で開いているため、カメラを使えません。',
      '画面右上のメニューから「Safariで開く」（Androidは「ブラウザで開く」）を選んで開き直してください。',
    ];
  }
  if (errName === 'NotAllowedError' || errName === 'SecurityError') {
    const lines = ['カメラの使用が許可されていません。次の設定を確認してから、ページを再読み込みしてください。'];
    if (iosChrome) lines.push('・「設定」アプリ →「Chrome」→「カメラ」をオン');
    else if (isIOS) {
      lines.push('・アドレスバー左の「ぁあ」→「Webサイトの設定」→「カメラ」を「許可」');
      lines.push('・それでも出る場合：「設定」アプリ →「Safari」→「カメラ」を「確認」または「許可」');
    } else {
      lines.push('・アドレスバー左のアイコン →「権限」または「サイトの設定」→「カメラ」を「許可」');
      lines.push('・それでも出る場合：「設定」→「アプリ」→「Chrome」→「権限」→「カメラ」を許可');
    }
    return lines;
  }
  if (errName === 'NotReadableError' || errName === 'AbortError') {
    return ['カメラをほかのアプリが使っています。カメラアプリなどを閉じてから、もう一度お試しください。'];
  }
  if (errName === 'NotFoundError' || errName === 'OverconstrainedError') {
    return [`使えるカメラが見つかりませんでした（${errName}）。`];
  }
  if (errName === 'Unsupported') {
    return ['このブラウザではアプリ内カメラを使えません。Safari（iPhone）またはChrome（Android）で開いてください。'];
  }
  return [`カメラを起動できませんでした（${errName || 'エラー'}）。`];
}

const MAX_SHOT_EDGE = 2400;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('時間切れ')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

function InAppCamera({ onShot }: { onShot: (blob: Blob, category: PhotoCategory) => void }) {
  const [category, setCategory] = useState<PhotoCategory>('現状');
  const [running, setRunning] = useState(false);
  const [help, setHelp] = useState<string[] | null>(null);
  const [caps, setCaps] = useState<CameraCaps>({});
  const [zoom, setZoom] = useState(1);
  const [torchOn, setTorchOn] = useState(false);
  const [count, setCount] = useState(0);
  const [flash, setFlash] = useState(false);
  const [shooting, setShooting] = useState(false);
  const [shotError, setShotError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const captureRef = useRef<any>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    trackRef.current = null;
    captureRef.current = null;
    setRunning(false);
    setTorchOn(false);
  }, []);

  useEffect(() => {
    window.addEventListener('pagehide', stop);
    return () => {
      window.removeEventListener('pagehide', stop);
      stop();
    };
  }, [stop]);

  const start = async () => {
    setHelp(null);
    if (/Line\/|FBAN|FBAV|Instagram|GSA\/|YJApp|Twitter/i.test(navigator.userAgent)) {
      setHelp(cameraHelp('InApp'));
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setHelp(cameraHelp('Unsupported'));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 4096 }, height: { ideal: 3072 } },
      });
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      trackRef.current = track;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
      const w = window as unknown as { ImageCapture?: new (t: MediaStreamTrack) => unknown };
      if (w.ImageCapture) {
        try {
          captureRef.current = new w.ImageCapture(track);
        } catch {
          captureRef.current = null;
        }
      }
      const c = (track.getCapabilities ? track.getCapabilities() : {}) as CameraCaps;
      const settings = (track.getSettings ? track.getSettings() : {}) as { zoom?: number };
      setCaps({ torch: !!c.torch, zoom: c.zoom });
      if (c.zoom) setZoom(settings.zoom || c.zoom.min);
      setRunning(true);
    } catch (err) {
      setHelp(cameraHelp((err as { name?: string })?.name));
      stop();
    }
  };

  // 撮った画像は長辺 MAX_SHOT_EDGE に縮めてから渡す（大きすぎる画像は端末によって変換に失敗するため）
  const drawScaled = (src: CanvasImageSource, w: number, h: number): Promise<Blob | null> => {
    if (!w || !h) return Promise.resolve(null);
    const scale = Math.min(1, MAX_SHOT_EDGE / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return Promise.resolve(null);
    ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9));
  };

  /** 映像の1コマを取る。映像の準備ができるまで少し待つ */
  const grabFrame = async (): Promise<Blob | null> => {
    const video = videoRef.current;
    if (!video) return null;
    for (let i = 0; i < 15 && (!video.videoWidth || video.readyState < 2); i++) {
      await new Promise((r) => setTimeout(r, 100));
    }
    return drawScaled(video, video.videoWidth, video.videoHeight);
  };

  /** 高画質の静止画撮影（Androidの一部）。止まったり失敗したりする機種があるので時間を区切る */
  const takeStill = async (): Promise<Blob | null> => {
    const cap = captureRef.current;
    if (!cap?.takePhoto) return null;
    try {
      const photo = await withTimeout<Blob>(cap.takePhoto(), 4000);
      const bmp = await withTimeout<ImageBitmap>(createImageBitmap(photo), 4000);
      const out = await drawScaled(bmp, bmp.width, bmp.height);
      bmp.close?.();
      return out;
    } catch {
      // この機種では静止画撮影を使わず、以後は映像の1コマで撮る
      captureRef.current = null;
      return null;
    }
  };

  const shoot = async () => {
    if (!streamRef.current || shooting) return;
    setShooting(true);
    setShotError('');
    setFlash(true);
    setTimeout(() => setFlash(false), 120);
    const cat = category;
    try {
      const blob = (await takeStill()) ?? (await grabFrame());
      if (!blob) throw new Error('画像を取り込めませんでした');
      setCount((n) => n + 1);
      onShot(blob, cat);
    } catch (e) {
      setShotError(`撮影に失敗しました（${e instanceof Error ? e.message : 'エラー'}）。もう一度シャッターを押してください。`);
    } finally {
      setShooting(false);
    }
  };

  const applyAdvanced = (constraint: Record<string, unknown>) => {
    trackRef.current
      ?.applyConstraints({ advanced: [constraint as MediaTrackConstraintSet] })
      .catch(() => undefined);
  };

  return (
    <div className="space-y-3">
      <CategorySegment value={category} onChange={setCategory} />
      <div className="relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden rounded-xl bg-gray-900">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        <div
          className="pointer-events-none absolute inset-0 bg-white transition-opacity duration-100"
          style={{ opacity: flash ? 0.8 : 0 }}
        />
        {running && (
          <span
            className="absolute left-3 top-3 rounded px-2 py-0.5 text-xs font-semibold text-white"
            style={{ background: PHOTO_CATEGORY_STYLE[category].color }}
          >
            {category}
          </span>
        )}
        {!running && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-5 text-center text-white">
            {help ? (
              <p className="text-left text-sm leading-relaxed">
                {help.map((l, i) => (
                  <span key={i} className="block">
                    {l}
                  </span>
                ))}
              </p>
            ) : (
              <p className="text-sm">カメラを起動すると、ここに映像が出ます。</p>
            )}
            <button type="button" onClick={start} className="btn btn-primary">
              {help ? 'もう一度試す' : 'カメラを起動'}
            </button>
          </div>
        )}
      </div>

      {running && (
        <div className="mx-auto max-w-md space-y-3">
          <div className="flex items-center justify-between">
            {caps.torch ? (
              <button
                type="button"
                onClick={() => {
                  const next = !torchOn;
                  setTorchOn(next);
                  applyAdvanced({ torch: next });
                }}
                className="btn btn-secondary btn-sm w-20"
              >
                {torchOn ? 'ライト消' : 'ライト'}
              </button>
            ) : (
              <span className="w-20" />
            )}
            <button
              type="button"
              onClick={shoot}
              disabled={shooting}
              aria-label={`${category}を撮影`}
              className="h-16 w-16 rounded-full border-4 border-white shadow-lg ring-2 ring-gray-300 transition-transform active:scale-95"
              style={{ background: PHOTO_CATEGORY_STYLE[category].color }}
            />
            <span className="w-20 text-right text-sm tabular-nums text-gray-700">{count}枚</span>
          </div>
          {caps.zoom && (
            <label className="flex items-center gap-3 text-sm text-gray-700">
              ズーム
              <input
                type="range"
                min={caps.zoom.min}
                max={caps.zoom.max}
                step={caps.zoom.step || 0.1}
                value={zoom}
                onChange={(e) => {
                  const z = Number(e.target.value);
                  setZoom(z);
                  applyAdvanced({ zoom: z });
                }}
                className="flex-1"
              />
              <span className="w-12 text-right tabular-nums">{zoom.toFixed(1)}倍</span>
            </label>
          )}
          {shotError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {shotError}
            </p>
          )}
          <button type="button" onClick={stop} className="btn btn-secondary btn-sm w-full">
            カメラを止める
          </button>
        </div>
      )}
      <p className="text-xs text-gray-500">
        区分を切り替えながら、シャッターを押すたびに1枚ずつアップします。画質は機種によってスマホのカメラより下がることがあります。
      </p>
    </div>
  );
}

// ─── サムネイル ───
function PendingThumb({ item, onRetry, onDiscard }: { item: PendingItem; onRetry: () => void; onDiscard: () => void }) {
  return (
    <div>
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-gray-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.preview} alt="アップ中の写真" className="h-full w-full object-cover opacity-70" />
        {item.status !== 'error' ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="rounded bg-black/60 px-2 py-1 text-xs text-white">
              {item.status === 'uploading' ? 'アップ中…' : '待機中'}
            </span>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 p-2 text-center">
            <span className="text-xs text-white">{item.error}</span>
            <div className="flex gap-2">
              <button type="button" onClick={onRetry} className="btn btn-primary btn-sm">
                再試行
              </button>
              <button type="button" onClick={onDiscard} className="btn btn-secondary btn-sm">
                取消
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PhotoThumb({
  photo,
  driveError,
  onChangeCategory,
  onRetryDrive,
  onDelete,
}: {
  photo: ReportPhoto;
  driveError?: string;
  onChangeCategory: (c: PhotoCategory) => void;
  onRetryDrive: () => void;
  onDelete: () => void;
}) {
  const style = PHOTO_CATEGORY_STYLE[photo.category as PhotoCategory] ?? PHOTO_CATEGORY_STYLE['その他'];
  const method = CAPTURE_METHODS.find((m) => m.key === photo.capture_method)?.label;
  return (
    <div className="space-y-1.5">
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-gray-100">
        <a href={photo.file_url} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.file_url} alt={`${photo.category}の写真`} loading="lazy" className="h-full w-full object-cover" />
        </a>
        <button
          type="button"
          onClick={onDelete}
          aria-label="削除"
          className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-sm text-white hover:bg-black/80"
        >
          ×
        </button>
      </div>
      <div className="flex items-center gap-2">
        <select
          aria-label="区分を変更"
          value={photo.category}
          onChange={(e) => onChangeCategory(e.target.value as PhotoCategory)}
          className="rounded px-2 py-1 text-xs font-semibold text-white"
          style={{ background: style.color }}
        >
          {PHOTO_CATEGORIES.map((c) => (
            <option key={c} value={c} className="bg-white text-gray-900">
              {c}
            </option>
          ))}
        </select>
        {photo.drive_file_url ? (
          <a href={photo.drive_file_url} target="_blank" rel="noreferrer" className="text-xs text-murata-primary hover:underline">
            ドライブ保存済
          </a>
        ) : driveError || photo.capture_method ? (
          <button type="button" onClick={onRetryDrive} className="text-xs text-red-600 hover:underline" title={driveError}>
            {driveError === '再送中…' ? '再送中…' : 'ドライブ未保存・再送'}
          </button>
        ) : null}
      </div>
      <p className="truncate text-[11px] text-gray-500" title={photo.drive_file_name || ''}>
        {photo.drive_file_name || new Date(photo.taken_at || photo.created_at).toLocaleString('ja-JP')}
        {method && `・${method}`}
      </p>
    </div>
  );
}
