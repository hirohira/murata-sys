'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import type { Report, ReportStatus, ReportFinding, FindingSeverity, ReportChapter } from '@/types';
import { REPORT_STATUS_COLORS, SEVERITY_COLORS } from '@/lib/constants';
import ReportSlidePreview from '@/components/reports/ReportSlidePreview';
import { getOutputChapters } from '@/lib/chapter-numbering';

export default function ReportDetailPage() {
  const router = useRouter();
  const params = useParams();
  const reportId = params.id as string;

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  // Editable fields
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [findings, setFindings] = useState<ReportFinding[]>([]);
  const [recommendation, setRecommendation] = useState('');

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const res = await fetch(`/api/reports/${reportId}`);
        if (!res.ok) throw new Error('取得に失敗しました');
        const { data } = await res.json();
        setReport(data);
        setTitle(data.title);
        setSummary(data.summary || '');
        setFindings(data.findings || []);
        setRecommendation(data.recommendation || '');
      } catch (err) {
        console.error('Report fetch error:', err);
        setError('報告書の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [reportId]);

  const handleStatusChange = async (newStatus: ReportStatus) => {
    try {
      const res = await fetch(`/api/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('更新に失敗しました');
      const { data } = await res.json();
      setReport((prev) => prev ? { ...prev, ...data } : prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ステータス変更に失敗しました');
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError('タイトルを入力してください');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, summary, findings, recommendation }),
      });
      if (!res.ok) throw new Error('保存に失敗しました');
      const { data } = await res.json();
      setReport((prev) => prev ? { ...prev, ...data } : prev);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('この報告書を削除しますか？')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/reports/${reportId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('削除に失敗しました');
      router.push('/reports');
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除に失敗しました');
      setDeleting(false);
    }
  };

  const handleExportPptx = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/reports/${reportId}/export`);
      if (!res.ok) throw new Error('エクスポートに失敗しました');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report?.title || '報告書'}.pptx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エクスポートに失敗しました');
    } finally {
      setExporting(false);
    }
  };

  const updateFinding = (index: number, field: keyof ReportFinding, value: string) => {
    setFindings((prev) =>
      prev.map((f, i) => (i === index ? { ...f, [field]: value } : f))
    );
  };

  const removeFinding = (index: number) => {
    setFindings((prev) => prev.filter((_, i) => i !== index));
  };

  const addFinding = () => {
    setFindings((prev) => [
      ...prev,
      {
        photoNumber: prev.length + 1,
        location: '',
        finding: '',
        severity: '経過観察' as FindingSeverity,
        recommendation: '',
      },
    ]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-murata-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error && !report) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
        <Link href="/reports" className="btn btn-secondary mt-4">
          報告書一覧に戻る
        </Link>
      </div>
    );
  }

  if (!report) return null;

  const statusColor = REPORT_STATUS_COLORS[report.status as ReportStatus];

  return (
    <div className="max-w-3xl mx-auto pb-24">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-500 mb-4">
        <Link href="/reports" className="hover:text-murata-primary">
          報告書
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900 truncate">{report.title}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span>{report.report_type === '調査報告書' ? '🔍' : '✅'}</span>
            <span className="text-sm text-gray-500">{report.report_type}</span>
            <span
              className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColor?.bg || 'bg-gray-100'} ${statusColor?.text || 'text-gray-600'}`}
            >
              {report.status}
            </span>
            {report.generated_by_ai && (
              <span className="text-xs text-blue-600">🤖 AI生成</span>
            )}
          </div>
          {!editing ? (
            <h2 className="text-lg font-bold text-gray-900">{report.title}</h2>
          ) : (
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="form-input text-lg font-bold"
            />
          )}
          {report.project && (
            <Link
              href={`/projects/${report.project.id}`}
              className="text-sm text-murata-primary hover:underline mt-1 inline-block"
            >
              {report.project.customer_name} - {report.project.site_name}
            </Link>
          )}
          <p className="text-xs text-gray-400 mt-1">
            作成日: {new Date(report.created_at).toLocaleDateString('ja-JP')}
            {report.updated_at !== report.created_at && (
              <> ・ 更新日: {new Date(report.updated_at).toLocaleDateString('ja-JP')}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!editing ? (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="btn btn-secondary btn-sm"
              >
                編集
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="btn btn-sm text-red-600 hover:bg-red-50 border border-red-200"
              >
                {deleting ? '削除中...' : '削除'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setTitle(report.title);
                  setSummary(report.summary || '');
                  setFindings(report.findings || []);
                  setRecommendation(report.recommendation || '');
                  setError('');
                }}
                className="btn btn-secondary btn-sm"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="btn btn-primary btn-sm"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Status change buttons */}
      {!editing && (
        <div className="flex flex-wrap gap-2 mb-5">
          {report.status === '下書き' && (
            <button
              type="button"
              onClick={() => handleStatusChange('確認中')}
              className="btn btn-sm bg-amber-100 text-amber-800 hover:bg-amber-200"
            >
              確認依頼を出す
            </button>
          )}
          {report.status === '確認中' && (
            <>
              <button
                type="button"
                onClick={() => handleStatusChange('承認済み')}
                className="btn btn-sm bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
              >
                承認する
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange('下書き')}
                className="btn btn-sm bg-gray-100 text-gray-600 hover:bg-gray-200"
              >
                差し戻す
              </button>
            </>
          )}
          {report.status === '承認済み' && (
            <button
              type="button"
              onClick={() => handleStatusChange('下書き')}
              className="btn btn-sm bg-gray-100 text-gray-600 hover:bg-gray-200"
            >
              下書きに戻す
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mb-5">
          {error}
        </div>
      )}

      {/* Summary */}
      <div className="card mb-5">
        <div className="card-header">
          <h3 className="font-semibold text-sm">
            {report.report_type === '調査報告書' ? '調査概要' : '工事概要'}
          </h3>
        </div>
        <div className="card-body">
          {!editing ? (
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {report.summary || '(概要なし)'}
            </p>
          ) : (
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={5}
              className="form-textarea"
            />
          )}
        </div>
      </div>

      {/* Findings */}
      <div className="card mb-5">
        <div className="card-header flex items-center justify-between">
          <h3 className="font-semibold text-sm">
            {report.report_type === '調査報告書' ? '所見一覧' : '施工内容'}
          </h3>
          {editing && (
            <button
              type="button"
              onClick={addFinding}
              className="text-xs text-murata-primary hover:underline"
            >
              + 項目追加
            </button>
          )}
        </div>
        <div className="card-body">
          {!editing ? (
            // View mode
            (report.findings || []).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">所見なし</p>
            ) : (
              <div className="space-y-4">
                {(report.findings || []).map((finding: ReportFinding, index: number) => {
                  const sevColor = SEVERITY_COLORS[finding.severity as FindingSeverity];
                  return (
                    <div
                      key={index}
                      className="border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-gray-700">
                          #{index + 1} {finding.location}
                        </span>
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${sevColor?.bg || 'bg-gray-100'} ${sevColor?.text || 'text-gray-600'}`}
                        >
                          {finding.severity}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mb-2 whitespace-pre-wrap">
                        {finding.finding}
                      </p>
                      {finding.recommendation && (
                        <p className="text-xs text-gray-500">
                          <span className="font-medium">推奨対応:</span>{' '}
                          {finding.recommendation}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            // Edit mode
            <div className="space-y-4">
              {findings.map((finding, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">
                      #{index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFinding(index)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      削除
                    </button>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">箇所</label>
                    <input
                      type="text"
                      value={finding.location}
                      onChange={(e) => updateFinding(index, 'location', e.target.value)}
                      className="form-input text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">
                      {report.report_type === '調査報告書' ? '所見' : '施工内容'}
                    </label>
                    <textarea
                      value={finding.finding}
                      onChange={(e) => updateFinding(index, 'finding', e.target.value)}
                      rows={3}
                      className="form-textarea text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">
                        {report.report_type === '調査報告書' ? '重要度' : '状態'}
                      </label>
                      <select
                        value={finding.severity}
                        onChange={(e) => updateFinding(index, 'severity', e.target.value)}
                        className="form-select text-sm"
                      >
                        <option value="要補修">要補修</option>
                        <option value="経過観察">経過観察</option>
                        <option value="問題なし">問題なし</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">推奨対応</label>
                      <input
                        type="text"
                        value={finding.recommendation}
                        onChange={(e) =>
                          updateFinding(index, 'recommendation', e.target.value)
                        }
                        className="form-input text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
              {findings.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">
                  所見がありません
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Chapters (new wizard-based reports) */}
      {report.chapters && report.chapters.length > 0 && (
        <div className="card mb-5">
          <div className="card-header">
            <h3 className="font-semibold text-sm">章立て</h3>
          </div>
          <div className="card-body space-y-4">
            {getOutputChapters(report.chapters as ReportChapter[]).map(({ chapter: ch, displayTitle }, idx) => {
              return (
                <div key={ch.id || idx} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="text-sm font-semibold text-gray-900">{displayTitle}</h4>
                    {ch.ai_generated && (
                      <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">AI</span>
                    )}
                  </div>
                  {ch.photos && ch.photos.length > 0 && (
                    <div className="flex gap-1.5 mb-3 overflow-x-auto">
                      {ch.photos.map((p) => (
                        <div key={p.id} className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.url || ''} alt={p.caption || ''} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}
                  {ch.description && (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{ch.description}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Slide Preview (茂様式) */}
      {report.chapters && report.chapters.length > 0 && (
        <div className="card mb-5">
          <div className="card-body">
            <ReportSlidePreview report={report} />
          </div>
          <div className="card-body border-t border-gray-100 pt-3">
            <button
              type="button"
              onClick={handleExportPptx}
              disabled={exporting}
              className="w-full flex items-center justify-center gap-2 btn btn-primary"
            >
              {exporting ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  エクスポート中...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  PowerPointエクスポート
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Recommendation */}
      <div className="card mb-5">
        <div className="card-header">
          <h3 className="font-semibold text-sm">総合推奨事項</h3>
        </div>
        <div className="card-body">
          {!editing ? (
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {report.recommendation || '(推奨事項なし)'}
            </p>
          ) : (
            <textarea
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value)}
              rows={4}
              className="form-textarea"
            />
          )}
        </div>
      </div>
    </div>
  );
}
