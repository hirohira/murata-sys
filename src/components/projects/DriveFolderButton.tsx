'use client';

import { useState } from 'react';
import type { Project } from '@/types';

/** 現場フォルダ（Googleドライブ）を開く／作成するボタン */
export default function DriveFolderButton({
  project,
  onCreated,
}: {
  project: Project;
  onCreated?: (folder: { id: string; url: string }) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  if (project.drive_folder_url) {
    return (
      <a
        href={project.drive_folder_url}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-secondary btn-sm"
      >
        Googleドライブで開く
      </a>
    );
  }

  const create = async () => {
    setCreating(true);
    setError('');
    try {
      const res = await fetch(`/api/projects/${project.id}/drive-folder`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'フォルダ作成に失敗しました');
      onCreated?.(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'フォルダ作成に失敗しました');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={create} disabled={creating} className="btn btn-secondary btn-sm">
        {creating ? 'フォルダ作成中...' : 'ドライブに現場フォルダを作成'}
      </button>
      {error && <p className="text-xs text-red-600 max-w-xs text-right">{error}</p>}
    </div>
  );
}
