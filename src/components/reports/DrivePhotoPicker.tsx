'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ChapterPhoto, PhotoTag } from '@/types';

interface DrivePhoto {
  id: string;
  name: string;
  folderPath: string;
}

interface Props {
  projectId: string;
  chapterTitle: string;
  onClose: () => void;
  onImported: (photos: ChapterPhoto[]) => void;
}

const CONCURRENCY = 3;

/** 現場フォルダ（Googleドライブ）の写真を選んで章に取り込む */
export default function DrivePhotoPicker({ projectId, chapterTitle, onClose, onImported }: Props) {
  const [photos, setPhotos] = useState<DrivePhoto[]>([]);
  const [folderUrl, setFolderUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/drive-photos`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || '写真一覧を取得できませんでした');
        setPhotos(json.data || []);
        setFolderUrl(json.folderUrl || '');
      } catch (err) {
        setError(err instanceof Error ? err.message : '写真一覧を取得できませんでした');
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  const groups = useMemo(() => {
    const map = new Map<string, DrivePhoto[]>();
    for (const p of photos) {
      const list = map.get(p.folderPath) ?? [];
      list.push(p);
      map.set(p.folderPath, list);
    }
    return Array.from(map.entries());
  }, [photos]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleGroup = (list: DrivePhoto[]) =>
    setSelected((prev) => {
      const next = new Set(prev);
      const allOn = list.every((p) => next.has(p.id));
      list.forEach((p) => (allOn ? next.delete(p.id) : next.add(p.id)));
      return next;
    });

  const handleImport = async () => {
    const targets = photos.filter((p) => selected.has(p.id));
    if (targets.length === 0) return;
    setImporting(true);
    setDone(0);
    setError('');

    const results: (ChapterPhoto | null)[] = new Array(targets.length).fill(null);
    const failed: string[] = [];
    let cursor = 0;

    const worker = async () => {
      while (cursor < targets.length) {
        const idx = cursor++;
        const t = targets[idx];
        try {
          const res = await fetch(`/api/projects/${projectId}/drive-photos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileId: t.id, folderPath: t.folderPath }),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error);
          results[idx] = {
            id: `drive-${t.id}-${Date.now()}`,
            url: json.data.url,
            preview: json.data.url,
            path: json.data.path,
            caption: json.data.caption || '',
            sort_order: idx,
            tag: json.data.tag as PhotoTag | undefined,
          };
        } catch {
          failed.push(t.name);
        } finally {
          setDone((d) => d + 1);
        }
      }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    const imported = results.filter((r): r is ChapterPhoto => r !== null);
    if (imported.length > 0) onImported(imported);
    if (failed.length > 0) {
      setError(`${failed.length}枚の取り込みに失敗しました：${failed.slice(0, 3).join('、')}${failed.length > 3 ? ' ほか' : ''}`);
      setImporting(false);
      setSelected(new Set());
      return;
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" role="dialog" aria-modal="true">
      <div className="bg-white w-full sm:max-w-3xl max-h-[90vh] rounded-t-2xl sm:rounded-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900">ドライブから写真を取り込む</h3>
            <p className="text-xs text-gray-500 mt-0.5">取り込み先：{chapterTitle}</p>
          </div>
          <button type="button" onClick={onClose} disabled={importing} className="text-gray-400 hover:text-gray-600 p-1" aria-label="閉じる">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-murata-primary border-t-transparent rounded-full" />
            </div>
          )}

          {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

          {!loading && !error && photos.length === 0 && (
            <div className="text-center py-10 text-sm text-gray-500 space-y-2">
              <p>現場フォルダに写真がありません。</p>
              <p className="text-xs">
                「03_現場調査」「05_施工写真」などに写真を入れてから、もう一度開いてください。
              </p>
              {folderUrl && (
                <a href={folderUrl} target="_blank" rel="noopener noreferrer" className="text-murata-primary underline text-xs">
                  現場フォルダを開く
                </a>
              )}
            </div>
          )}

          {groups.map(([path, list]) => {
            const allOn = list.every((p) => selected.has(p.id));
            return (
              <section key={path}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-gray-600">
                    {path} <span className="text-gray-400 font-normal">（{list.length}枚）</span>
                  </h4>
                  <button type="button" onClick={() => toggleGroup(list)} className="text-xs text-murata-primary hover:underline">
                    {allOn ? '選択を外す' : 'すべて選択'}
                  </button>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {list.map((p) => {
                    const on = selected.has(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggle(p.id)}
                        title={p.name}
                        className={`relative aspect-square rounded-lg overflow-hidden border-2 bg-gray-100 ${
                          on ? 'border-murata-primary' : 'border-transparent'
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/drive/thumbnail/${p.id}`} alt={p.name} loading="lazy" className="w-full h-full object-cover" />
                        {on && (
                          <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-murata-primary text-white flex items-center justify-center">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            {importing ? `取り込み中… ${done} / ${selected.size}` : `${selected.size}枚選択中`}
          </p>
          <button
            type="button"
            onClick={handleImport}
            disabled={importing || selected.size === 0}
            className="btn btn-primary btn-sm"
          >
            {importing ? '取り込み中...' : '選択した写真を取り込む'}
          </button>
        </div>
      </div>
    </div>
  );
}
