'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Project, ReportType } from '@/types';

interface ChatSummary {
  id: string;
  report_type: ReportType;
  report_id: string | null;
  updated_at: string;
  message_count: number;
  photo_count: number;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function ChatStart() {
  const params = useSearchParams();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState(params.get('projectId') || '');
  const [reportType, setReportType] = useState<ReportType>('調査報告書');
  const [chats, setChats] = useState<ChatSummary[] | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((j) => setProjects(j.data || []))
      .catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    if (!projectId) {
      setChats(null);
      return;
    }
    setChats(null);
    fetch(`/api/report-chats?projectId=${projectId}`)
      .then((r) => r.json())
      .then((j) => setChats(j.data || []))
      .catch(() => setChats([]));
  }, [projectId]);

  const start = async () => {
    setStarting(true);
    setError('');
    try {
      const res = await fetch('/api/report-chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, report_type: reportType }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || '始められませんでした');
      router.push(`/reports/chat/${json.data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '始められませんでした');
      setStarting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="text-sm text-gray-500">
        <Link href="/reports" className="hover:text-murata-primary">
          報告書
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">チャットで作成</span>
      </div>
      <div>
        <h2 className="text-lg font-bold text-gray-900">チャットで報告書を作成</h2>
        <p className="mt-1 text-sm text-gray-600">
          LINEのように「現状」「原因」などのボタンを押して、写真とコメントを投稿していきます。投稿した順番のまま報告書になります。
        </p>
      </div>

      <div className="card">
        <div className="card-body space-y-4">
          <div>
            <label htmlFor="chat-project" className="form-label">
              案件
            </label>
            <select id="chat-project" className="form-select" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">案件を選んでください</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.project_id}　{p.customer_name} - {p.site_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="form-label">報告書の種類</p>
            <div className="grid grid-cols-2 gap-2">
              {(['調査報告書', '完了報告書'] as ReportType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setReportType(t)}
                  aria-pressed={reportType === t}
                  className={`rounded-lg border px-3 py-2.5 text-sm font-medium ${
                    reportType === t ? 'border-murata-primary bg-murata-primary/5 text-murata-primary' : 'border-gray-300 text-gray-700'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button type="button" className="btn btn-primary w-full btn-lg" disabled={!projectId || starting} onClick={start}>
            {starting ? '準備しています…' : '新しいチャットを始める'}
          </button>
        </div>
      </div>

      {projectId && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-sm font-semibold text-gray-900">この案件の途中のチャット</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {chats === null ? (
              <p className="px-5 py-4 text-sm text-gray-500">読み込んでいます…</p>
            ) : chats.length === 0 ? (
              <p className="px-5 py-4 text-sm text-gray-500">まだありません。</p>
            ) : (
              chats.map((c) => (
                <Link
                  key={c.id}
                  href={`/reports/chat/${c.id}`}
                  className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-gray-50"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{c.report_type}</p>
                    <p className="text-xs text-gray-500">
                      最終投稿 {formatTime(c.updated_at)}・投稿 {c.message_count}件・写真 {c.photo_count}枚
                    </p>
                  </div>
                  <span
                    className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      c.report_id ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {c.report_id ? '作成済み' : '投稿中'}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChatStartPage() {
  return (
    <Suspense fallback={null}>
      <ChatStart />
    </Suspense>
  );
}
