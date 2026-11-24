'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import VoiceRecorder from '@/components/VoiceRecorder';
import ProjectPhotoPicker from '@/components/reports/ProjectPhotoPicker';
import { resizeForUpload } from '@/lib/compress-photo';
import {
  CHAT_SECTIONS,
  SECTION_BY_KEY,
  currentSection,
  isCreateRequest,
  newMessageId,
  nextSectionIndex,
  parseChat,
  sectionLabel,
  type ChatMessage,
  type ChatPhoto,
  type ChatSectionKey,
  type ReportChat,
} from '@/lib/report-chat';
import type { ChapterPhoto, Project, ReportPhoto } from '@/types';

type SaveState = 'saved' | 'saving' | 'error' | 'conflict';

interface PendingUpload {
  files: File[];
  previews: string[];
  slots: (ChatPhoto | null)[];
  status: ('uploading' | 'done' | 'error')[];
  errors: (string | undefined)[];
  category: string;
  method: 'camera' | 'select';
}

interface Result {
  id: string;
  ai: boolean;
  aiError: string | null;
  drive: { url: string; name: string } | null;
  driveError: string | null;
}

const GEN_STEPS = ['投稿を読み取り、AIが見出しと説明文を整えています', 'PowerPointを作ってドライブに保存しています'];

function hhmm(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function ChatReportPage({ params }: { params: { id: string } }) {
  const [chat, setChat] = useState<(ReportChat & { project: Project }) | null>(null);
  const [loadError, setLoadError] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [myName, setMyName] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [pending, setPending] = useState<Record<string, PendingUpload>>({});
  const [input, setInput] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [topicId, setTopicId] = useState<string | null>(null);
  const [topicText, setTopicText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genStep, setGenStep] = useState(0);
  const [genError, setGenError] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [notice, setNotice] = useState('');

  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;
  const updatedAtRef = useRef<string | null>(null);
  // アップ中の写真（ファイルと、アップが済んだ写真）。状態の更新を待たずに読めるよう ref で持つ
  const uploadsRef = useRef<Record<string, { files: File[]; slots: (ChatPhoto | null)[] }>>({});
  const pendingRef = useRef<Record<string, PendingUpload>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  // ── 読み込み ──
  useEffect(() => {
    (async () => {
      try {
        const [c, me] = await Promise.all([
          fetch(`/api/report-chats/${params.id}`).then(async (r) => {
            const j = await r.json();
            if (!r.ok) throw new Error(j.error || 'チャットを読み込めませんでした');
            return j.data;
          }),
          fetch('/api/me')
            .then((r) => r.json())
            .catch(() => ({})),
        ]);
        setChat(c);
        setMessages(Array.isArray(c.messages) ? c.messages : []);
        updatedAtRef.current = c.updated_at;
        setMyName(me?.data?.name || '');
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : 'チャットを読み込めませんでした');
      }
    })();
  }, [params.id]);

  // 新しい投稿が来たら一番下へ
  const count = messages.length;
  // 入力欄は画面の下に固定しているので、ページの一番下までスクロールする
  useEffect(() => {
    const id = setTimeout(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }), 50);
    return () => clearTimeout(id);
  }, [count, generating, result, genError]);

  // ── 保存（投稿のたびに少し待ってまとめて保存。保存中に変わったら続けて保存） ──
  const savingRef = useRef(false);
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveNow = useCallback(async (): Promise<boolean> => {
    if (savingRef.current) {
      dirtyRef.current = true;
      return false;
    }
    savingRef.current = true;
    dirtyRef.current = false;
    setSaveState('saving');
    try {
      const res = await fetch(`/api/report-chats/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messagesRef.current, updated_at: updatedAtRef.current }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setSaveState('conflict');
        return false;
      }
      if (!res.ok) throw new Error(json.error);
      updatedAtRef.current = json.data.updated_at;
      setSaveState('saved');
      return true;
    } catch {
      setSaveState('error');
      return false;
    } finally {
      savingRef.current = false;
      if (dirtyRef.current) setTimeout(() => void saveNow(), 0);
    }
  }, [params.id]);

  const scheduleSave = useCallback(() => {
    setSaveState('saving');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void saveNow(), 600);
  }, [saveNow]);

  /** 投稿を変更して保存（messagesRef も即時に更新し、続けて呼ばれても取りこぼさない） */
  const mutate = useCallback(
    (fn: (prev: ChatMessage[]) => ChatMessage[]) => {
      const next = fn(messagesRef.current);
      messagesRef.current = next;
      setMessages(next);
      scheduleSave();
    },
    [scheduleSave]
  );

  const flushSave = async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    for (let i = 0; i < 20 && savingRef.current; i++) await new Promise((r) => setTimeout(r, 250));
    return saveNow();
  };

  const stamp = () => ({ id: newMessageId(), at: new Date().toISOString(), ...(myName ? { by: myName } : {}) });

  // ── 区分ボタン ──
  const pressSection = (key: ChatSectionKey) => {
    mutate((prev) => [...prev, { ...stamp(), kind: 'section', section: key, index: nextSectionIndex(prev, key) }]);
    setNotice('');
  };

  /** 区分を選ぶ前に写真やコメントを投稿したときは「現状」を自動で入れる */
  const ensureSection = (prev: ChatMessage[]): ChatMessage[] =>
    currentSection(prev) ? prev : [...prev, { ...stamp(), kind: 'section', section: '現状', index: 1 }];

  // ── 写真 ──
  const uploadSlot = async (msgId: string, i: number) => {
    const up = uploadsRef.current[msgId];
    const file = up?.files[i];
    const p = pendingRef.current[msgId];
    if (!up || !file || !p) return;
    setPending((prev) => {
      const cur = prev[msgId];
      if (!cur) return prev;
      const status = [...cur.status];
      status[i] = 'uploading';
      return { ...prev, [msgId]: { ...cur, status } };
    });
    try {
      const { blob, width, height } = await resizeForUpload(file);
      const form = new FormData();
      form.append('file', blob, 'photo.jpg');
      form.append('category', p.category);
      form.append('method', p.method);
      if (file.lastModified) form.append('taken_at', new Date(file.lastModified).toISOString());
      form.append('width', String(width));
      form.append('height', String(height));
      const res = await fetch(`/api/projects/${chat!.project_id}/photos`, { method: 'POST', body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `アップできませんでした（${res.status}）`);
      const saved = json.data as ReportPhoto;
      const photo: ChatPhoto = { id: saved.id, url: saved.file_url, path: saved.file_path };
      up.slots[i] = photo;
      setPending((prev) => {
        const cur = prev[msgId];
        if (!cur) return prev;
        const slots = [...cur.slots];
        slots[i] = photo;
        const status = [...cur.status];
        status[i] = 'done';
        return { ...prev, [msgId]: { ...cur, slots, status } };
      });
      // 投稿の写真は「選んだ順番」で並べる（先に終わった写真から入れても順番は崩さない）
      const ordered = up.slots.filter((x): x is ChatPhoto => x !== null);
      mutate((prev) => prev.map((m) => (m.id === msgId && m.kind === 'photos' ? { ...m, photos: ordered } : m)));
    } catch (e) {
      setPending((prev) => {
        const cur = prev[msgId];
        if (!cur) return prev;
        const status = [...cur.status];
        status[i] = 'error';
        const errors = [...cur.errors];
        errors[i] = e instanceof Error ? e.message : 'アップできませんでした';
        return { ...prev, [msgId]: { ...cur, status, errors } };
      });
    }
  };

  pendingRef.current = pending;

  // すべてアップできたら、待ちの表示を片付ける
  useEffect(() => {
    for (const [id, p] of Object.entries(pending)) {
      if (p.status.every((s) => s === 'done')) {
        p.previews.forEach((u) => URL.revokeObjectURL(u));
        delete uploadsRef.current[id];
        setPending((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    }
  }, [pending]);

  const addFiles = async (list: FileList | null, method: 'camera' | 'select') => {
    const files = Array.from(list || []).filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|heic|heif|webp)$/i.test(f.name));
    if (files.length === 0 || !chat) return;
    // 撮影日時の順に並べる（遠景→アップの順に撮っていれば、そのままの並びになる）
    files.sort((a, b) => a.lastModified - b.lastModified);
    const base = ensureSection(messagesRef.current);
    const sec = currentSection(base)!;
    const msgId = newMessageId();
    uploadsRef.current[msgId] = { files, slots: files.map(() => null) };
    const entry: PendingUpload = {
      files,
      previews: files.map((f) => URL.createObjectURL(f)),
      slots: files.map(() => null),
      status: files.map(() => 'uploading'),
      errors: files.map(() => undefined),
      category: SECTION_BY_KEY[sec.section].category,
      method,
    };
    pendingRef.current = { ...pendingRef.current, [msgId]: entry };
    setPending(pendingRef.current);
    mutate(() => [...base, { ...stamp(), id: msgId, kind: 'photos', photos: [] }]);

    // 2枚ずつ並行してアップ
    let next = 0;
    const worker = async () => {
      while (next < files.length) {
        const i = next++;
        await uploadSlot(msgId, i);
      }
    };
    await Promise.all([worker(), worker()]);
  };

  const importProjectPhotos = (photos: ChapterPhoto[]) => {
    const chosen = photos.filter((p) => p.url && p.path).map((p) => ({ id: p.id, url: p.url!, path: p.path! }));
    if (chosen.length === 0) return;
    mutate((prev) => [...ensureSection(prev), { ...stamp(), kind: 'photos', photos: chosen }]);
    setPickerOpen(false);
  };

  const removePhoto = (msgId: string, path: string) =>
    mutate((prev) =>
      prev
        .map((m) => (m.id === msgId && m.kind === 'photos' ? { ...m, photos: m.photos.filter((p) => p.path !== path) } : m))
        .filter((m) => !(m.id === msgId && m.kind === 'photos' && m.photos.length === 0 && !pendingRef.current[msgId]))
    );

  // ── コメント ──
  const send = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    if (isCreateRequest(text)) {
      mutate((prev) => [...prev, { ...stamp(), kind: 'text', text }]);
      await generate();
      return;
    }
    mutate((prev) => [...ensureSection(prev), { ...stamp(), kind: 'text', text }]);
  };

  const removeMessage = (id: string) => {
    if (!window.confirm('この投稿を削除しますか？（写真は案件の「写真」には残ります）')) return;
    mutate((prev) => prev.filter((m) => m.id !== id));
  };

  const saveEdit = () => {
    const t = editText.trim();
    if (editingId) mutate((prev) => prev.map((m) => (m.id === editingId && m.kind === 'text' ? { ...m, text: t || m.text } : m)));
    setEditingId(null);
  };

  const saveTopic = () => {
    const t = topicText.trim().slice(0, 40);
    if (topicId) mutate((prev) => prev.map((m) => (m.id === topicId && m.kind === 'section' ? { ...m, topic: t || undefined } : m)));
    setTopicId(null);
  };

  // ── 報告書を作る ──
  const uploading = Object.values(pending).some((p) => p.status.some((s) => s === 'uploading'));
  const failedUploads = Object.values(pending).some((p) => p.status.some((s) => s === 'error'));
  const parsed = useMemo(() => parseChat(messages), [messages]);

  const generate = async () => {
    setGenError('');
    setResult(null);
    if (uploading) {
      setGenError('写真のアップが終わってから、もう一度押してください。');
      return;
    }
    if (parseChat(messagesRef.current).sections.length === 0) {
      setGenError('区分ボタンを押して、写真かコメントを投稿してください。');
      return;
    }
    setGenerating(true);
    setGenStep(0);
    try {
      await flushSave();
      const res = await fetch(`/api/report-chats/${params.id}/generate`, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `報告書を作れませんでした（${res.status}）`);
      const made = json.data as { id: string; ai: boolean; aiError: string | null };
      setGenStep(1);
      let drive: Result['drive'] = null;
      let driveError: string | null = null;
      try {
        const d = await fetch(`/api/reports/${made.id}/drive`, { method: 'POST' });
        const dj = await d.json().catch(() => ({}));
        if (!d.ok) throw new Error(dj.error || `ドライブに保存できませんでした（${d.status}）`);
        drive = dj.data;
      } catch (e) {
        driveError = e instanceof Error ? e.message : 'ドライブに保存できませんでした';
      }
      setResult({ id: made.id, ai: made.ai, aiError: made.aiError, drive, driveError });
      setChat((c) => (c ? { ...c, report_id: made.id } : c));
    } catch (e) {
      setGenError(e instanceof Error ? e.message : '報告書を作れませんでした');
    } finally {
      setGenerating(false);
    }
  };

  // ── 表示 ──
  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</p>
        <Link href="/reports/chat" className="btn btn-secondary mt-4">
          戻る
        </Link>
      </div>
    );
  }
  if (!chat) return <p className="text-sm text-gray-500">読み込んでいます…</p>;

  const active = currentSection(messages);
  const activeDef = active ? SECTION_BY_KEY[active.section] : null;

  return (
    <div className="mx-auto max-w-2xl">
      {/* 見出し */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-gray-500">
            <Link href={`/reports/chat?projectId=${chat.project_id}`} className="hover:text-murata-primary">
              チャットで作成
            </Link>
            <span className="mx-2">/</span>
            <span className="text-gray-900">{chat.report_type}</span>
          </div>
          <h2 className="mt-0.5 truncate text-base font-bold text-gray-900">
            {chat.project?.customer_name}　{chat.project?.site_name}
          </h2>
        </div>
        <SaveBadge state={saveState} onRetry={() => void saveNow()} />
      </div>

      {chat.report_id && !result && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          <span>この投稿から作った報告書があります。投稿を足して作り直すこともできます。</span>
          <Link href={`/reports/${chat.report_id}`} className="flex-shrink-0 font-medium underline">
            開く
          </Link>
        </div>
      )}

      {/* 投稿の一覧 */}
      <div className="space-y-3 rounded-xl bg-[#e9eef3] p-3 sm:p-4" aria-live="polite">
        <Bubble side="left" name="報告書アシスタント">
          <p>下のボタン（現状・原因・散水試験・対策…）を押してから、写真とコメントを投稿してください。</p>
          <p className="mt-1 text-gray-600">
            一度に添付した写真が1組になり、報告書では「遠景→アップ」の順に矢印でつなぎます。最後に「これで報告書を作成」を押すか、「これで報告書を作成お願いします」と送ってください。
          </p>
        </Bubble>

        {messages.map((m) => {
          if (m.kind === 'section') {
            const def = SECTION_BY_KEY[m.section];
            return (
              <div key={m.id} className="pt-2">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold text-white ${def.color}`}>{sectionLabel(m, messages)}</span>
                  <span className="h-px flex-1 bg-gray-300" />
                  <button type="button" onClick={() => removeMessage(m.id)} className="text-xs text-gray-400 hover:text-red-600">
                    削除
                  </button>
                </div>
                <Bubble side={m.by && m.by !== myName ? 'left' : 'right'} name={m.by} time={m.at}>
                  <p>{def.prompt}</p>
                  {topicId === m.id ? (
                    <div className="mt-2 flex gap-2">
                      <input
                        id={`topic-${m.id}`}
                        autoFocus
                        value={topicText}
                        onChange={(e) => setTopicText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveTopic()}
                        placeholder="例：シーリングの劣化"
                        className="form-input min-w-0 flex-1 py-1.5 text-sm"
                      />
                      <button type="button" className="btn btn-primary btn-sm" onClick={saveTopic}>
                        決定
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setTopicId(m.id);
                        setTopicText(m.topic || '');
                      }}
                      className="mt-1.5 text-xs font-medium text-murata-primary underline"
                    >
                      {m.topic ? `項目名：${m.topic}（変更）` : '＋ 項目名を付ける（見出しになります）'}
                    </button>
                  )}
                </Bubble>
              </div>
            );
          }

          if (m.kind === 'photos') {
            const p = pending[m.id];
            const tiles = p
              ? p.previews.map((preview, i) => ({ key: `${i}`, src: p.slots[i]?.url || preview, path: p.slots[i]?.path, status: p.status[i], error: p.errors[i], i }))
              : m.photos.map((ph, i) => ({ key: ph.path, src: ph.url, path: ph.path, status: 'done' as const, error: undefined, i }));
            if (tiles.length === 0) return null;
            return (
              <Bubble key={m.id} side={m.by && m.by !== myName ? 'left' : 'right'} name={m.by} time={m.at} wide onDelete={() => removeMessage(m.id)}>
                <div className="grid grid-cols-3 gap-1.5">
                  {tiles.map((t) => (
                    <div key={t.key} className="relative aspect-[4/3] overflow-hidden rounded-md bg-gray-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={t.src} alt={`${t.i + 1}枚目`} className={`h-full w-full object-cover ${t.status === 'uploading' ? 'opacity-50' : ''}`} />
                      <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 text-[11px] font-bold text-white tabular-nums">{t.i + 1}</span>
                      {t.status === 'uploading' && (
                        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-medium text-gray-800">アップ中…</span>
                      )}
                      {t.status === 'error' && (
                        <button
                          type="button"
                          onClick={() => void uploadSlot(m.id, t.i)}
                          title={t.error}
                          className="absolute inset-0 flex flex-col items-center justify-center bg-red-600/70 text-[11px] font-bold text-white"
                        >
                          失敗
                          <span className="underline">もう一度</span>
                        </button>
                      )}
                      {t.status === 'done' && t.path && (
                        <button
                          type="button"
                          aria-label={`${t.i + 1}枚目を外す`}
                          onClick={() => removePhoto(m.id, t.path!)}
                          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-sm text-white hover:bg-red-600"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {tiles.length > 1 && <p className="mt-1 text-[11px] text-gray-500">1 → {tiles.length} の順に並べます</p>}
              </Bubble>
            );
          }

          // コメント
          return (
            <Bubble key={m.id} side={m.by && m.by !== myName ? 'left' : 'right'} name={m.by} time={m.at} onDelete={() => removeMessage(m.id)}>
              {editingId === m.id ? (
                <div className="space-y-2">
                  <textarea
                    id={`edit-${m.id}`}
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={3}
                    className="form-input w-full text-sm"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>
                      やめる
                    </button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={saveEdit}>
                      保存
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="block w-full whitespace-pre-wrap text-left"
                  onClick={() => {
                    setEditingId(m.id);
                    setEditText(m.text);
                  }}
                  title="タップして直す"
                >
                  {m.text}
                </button>
              )}
            </Bubble>
          );
        })}

        {generating && (
          <Bubble side="left" name="報告書アシスタント">
            <ol className="space-y-1">
              {GEN_STEPS.map((s, i) => (
                <li key={s} className={i < genStep ? 'text-gray-400 line-through' : i === genStep ? 'font-medium' : 'text-gray-400'}>
                  {i === genStep ? '⏳ ' : i < genStep ? '✓ ' : '・'}
                  {s}
                </li>
              ))}
            </ol>
          </Bubble>
        )}

        {genError && (
          <Bubble side="left" name="報告書アシスタント">
            <p className="text-red-700">{genError}</p>
          </Bubble>
        )}

        {result && (
          <Bubble side="left" name="報告書アシスタント" wide>
            <p className="font-bold text-gray-900">報告書ができました</p>
            <p className="mt-1 text-gray-600">
              {parsed.sections.length}区分・写真{parsed.photoCount}枚を、投稿の順番どおりに並べました。
              {!result.ai && ' （AIが使えなかったため、コメントをそのまま説明文にしています）'}
            </p>
            {result.driveError && <p className="mt-1 text-amber-700">ドライブへの保存：{result.driveError}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {result.drive && (
                <a href={result.drive.url} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">
                  ドライブで開く
                </a>
              )}
              <a href={`/api/reports/${result.id}/export`} className="btn btn-secondary btn-sm">
                PowerPointをダウンロード
              </a>
              <Link href={`/reports/${result.id}`} className="btn btn-secondary btn-sm">
                確認・手直し
              </Link>
            </div>
          </Bubble>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 入力欄（画面の下に固定） */}
      <div className="sticky bottom-[60px] z-30 -mx-4 mt-3 border-t border-gray-200 bg-white px-3 pb-3 pt-2 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] lg:bottom-0 lg:mx-0 lg:rounded-xl lg:border">
        <div className="flex gap-1.5 overflow-x-auto pb-2" role="group" aria-label="区分">
          {CHAT_SECTIONS.map((s) => {
            const isActive = active?.section === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => pressSection(s.key)}
                title={s.hint}
                className={`flex-shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-bold transition-colors ${
                  isActive ? `${s.color} border-transparent text-white` : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {s.key}
              </button>
            );
          })}
        </div>
        <p className="truncate pb-1.5 text-xs text-gray-500">
          {active && activeDef ? (
            <>
              投稿先：<strong className="text-gray-800">{sectionLabel(active, messages)}</strong>（写真・コメントはここに入ります）
            </>
          ) : (
            'はじめに区分のボタンを押してください'
          )}
        </p>
        <div className="flex items-end gap-1.5">
          <input ref={cameraRef} id="chat-camera" type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { void addFiles(e.target.files, 'camera'); e.target.value = ''; }} />
          <input ref={libraryRef} id="chat-library" type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void addFiles(e.target.files, 'select'); e.target.value = ''; }} />
          <IconButton label="カメラで撮る" onClick={() => cameraRef.current?.click()}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </IconButton>
          <IconButton label="写真を選ぶ（まとめて）" onClick={() => libraryRef.current?.click()}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </IconButton>
          <IconButton label="案件の写真から選ぶ" onClick={() => setPickerOpen(true)}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
          </IconButton>
          <label htmlFor="chat-input" className="sr-only">
            コメント
          </label>
          <textarea
            id="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                void send();
              }
            }}
            rows={1}
            placeholder="コメント"
            className="form-input min-h-[44px] min-w-0 flex-1 resize-none py-2.5 text-sm"
          />
          <VoiceRecorder compact value={input} onChange={setInput} />
          <button
            type="button"
            onClick={() => void send()}
            disabled={!input.trim()}
            className="h-11 flex-shrink-0 rounded-full bg-murata-primary px-4 text-sm font-bold text-white disabled:opacity-40"
          >
            送信
          </button>
        </div>
        <button
          type="button"
          onClick={() => void generate()}
          disabled={generating || parsed.sections.length === 0}
          className="btn btn-accent mt-2 w-full"
        >
          {generating ? '作成しています…' : uploading ? '写真をアップしています…' : 'これで報告書を作成'}
        </button>
        {failedUploads && <p className="mt-1 text-xs text-red-600">アップできなかった写真があります。赤い写真を押すと再送します。</p>}
        {notice && <p className="mt-1 text-xs text-gray-600">{notice}</p>}
      </div>

      {pickerOpen && (
        <ProjectPhotoPicker
          projectId={chat.project_id}
          chapterTitle={active ? sectionLabel(active, messages) : '現状'}
          usedPaths={messages.flatMap((m) => (m.kind === 'photos' ? m.photos.map((p) => p.path) : []))}
          onClose={() => setPickerOpen(false)}
          onImported={importProjectPhotos}
        />
      )}
    </div>
  );
}

function SaveBadge({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state === 'saved') return <span className="flex-shrink-0 text-xs text-gray-400">保存済み</span>;
  if (state === 'saving') return <span className="flex-shrink-0 text-xs text-gray-400">保存中…</span>;
  if (state === 'conflict')
    return (
      <button type="button" onClick={() => window.location.reload()} className="flex-shrink-0 text-xs font-medium text-amber-700 underline">
        ほかの人が投稿しました（読み込み直す）
      </button>
    );
  return (
    <button type="button" onClick={onRetry} className="flex-shrink-0 text-xs font-medium text-red-600 underline">
      保存できませんでした（再試行）
    </button>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-11 w-9 flex-shrink-0 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 sm:w-11"
    >
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        {children}
      </svg>
    </button>
  );
}

function Bubble({
  side,
  name,
  time,
  wide,
  onDelete,
  children,
}: {
  side: 'left' | 'right';
  name?: string;
  time?: string;
  wide?: boolean;
  onDelete?: () => void;
  children: React.ReactNode;
}) {
  const right = side === 'right';
  return (
    <div className={`flex ${right ? 'justify-end' : 'justify-start'}`}>
      <div className={`${wide ? 'w-full max-w-[92%]' : 'max-w-[85%]'}`}>
        {!right && name && <p className="mb-0.5 text-[11px] text-gray-500">{name}</p>}
        <div className={`flex items-end gap-1.5 ${right ? 'flex-row-reverse' : ''}`}>
          <div
            className={`min-w-0 flex-1 rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
              right ? 'rounded-tr-sm bg-[#d7f5c9] text-gray-900' : 'rounded-tl-sm bg-white text-gray-900'
            }`}
          >
            {children}
          </div>
          <div className={`flex flex-shrink-0 flex-col gap-0.5 text-[10px] text-gray-500 ${right ? 'items-end' : 'items-start'}`}>
            {onDelete && (
              <button type="button" onClick={onDelete} className="text-gray-400 hover:text-red-600">
                削除
              </button>
            )}
            {time && <span>{hhmm(time)}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
