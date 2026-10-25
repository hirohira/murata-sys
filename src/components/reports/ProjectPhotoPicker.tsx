'use client';

import { useEffect, useState } from 'react';
import { PHOTO_CATEGORIES, PHOTO_CATEGORY_STYLE } from '@/lib/constants';
import type { ChapterPhoto, PhotoCategory, ReportPhoto } from '@/types';

interface Props {
  projectId: string;
  chapterTitle: string;
  /** すでに章に入っている写真のパス（重複して取り込まないよう印をつける） */
  usedPaths: string[];
  onClose: () => void;
  onImported: (photos: ChapterPhoto[]) => void;
}

/** 案件の「写真」画面でアップした写真を選んで章に取り込む */
export default function ProjectPhotoPicker({ projectId, chapterTitle, usedPaths, onClose, onImported }: Props) {
  const [photos, setPhotos] = useState<ReportPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/photos`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || '写真を読み込めませんでした');
        // 撮った順に並べる
        const list = ((json.data || []) as ReportPhoto[]).sort((a, b) =>
          (a.taken_at || a.created_at).localeCompare(b.taken_at || b.created_at)
        );
        setPhotos(list);
      } catch (e) {
        setError(e instanceof Error ? e.message : '写真を読み込めませんでした');
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  const used = new Set(usedPaths);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleGroup = (list: ReportPhoto[]) =>
    setSelected((prev) => {
      const next = new Set(prev);
      const allOn = list.every((p) => next.has(p.id));
      list.forEach((p) => (allOn ? next.delete(p.id) : next.add(p.id)));
      return next;
    });

  const handleImport = () => {
    const targets = photos.filter((p) => selected.has(p.id));
    if (targets.length === 0) return;
    onImported(
      targets.map((p, i) => ({
        id: `project-${p.id}-${Date.now()}`,
        url: p.file_url,
        preview: p.file_url,
        path: p.file_path,
        caption: p.caption || '',
        sort_order: i,
      }))
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" role="dialog" aria-modal="true">
      <div className="bg-white w-full sm:max-w-3xl max-h-[90vh] rounded-t-2xl sm:rounded-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900">案件の写真から取り込む</h3>
            <p className="text-xs text-gray-500 mt-0.5">取り込み先：{chapterTitle}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1" aria-label="閉じる">
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
            <p className="text-center py-10 text-sm text-gray-500">
              まだ写真がありません。案件詳細の「写真」タブで撮影・アップしてください。
            </p>
          )}

          {PHOTO_CATEGORIES.map((cat: PhotoCategory) => {
            const list = photos.filter((p) => p.category === cat);
            if (list.length === 0) return null;
            const allOn = list.every((p) => selected.has(p.id));
            return (
              <section key={cat}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                    <span className="rounded px-2 py-0.5 text-white" style={{ background: PHOTO_CATEGORY_STYLE[cat].color }}>
                      {cat}
                    </span>
                    {list.length}枚
                  </h4>
                  <button type="button" onClick={() => toggleGroup(list)} className="text-xs text-murata-primary hover:underline">
                    {allOn ? '選択を外す' : 'すべて選択'}
                  </button>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {list.map((p) => {
                    const on = selected.has(p.id);
                    const already = used.has(p.file_path);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggle(p.id)}
                        className={`relative aspect-square rounded-lg overflow-hidden border-2 bg-gray-100 ${
                          on ? 'border-murata-primary' : 'border-transparent'
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.file_url} alt={`${cat}の写真`} loading="lazy" className={`w-full h-full object-cover ${already ? 'opacity-50' : ''}`} />
                        {already && (
                          <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">取込済</span>
                        )}
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

        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-gray-100">
          <span className="text-sm text-gray-600">{selected.size}枚を選択中</span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              キャンセル
            </button>
            <button type="button" onClick={handleImport} disabled={selected.size === 0} className="btn btn-primary">
              取り込む
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
