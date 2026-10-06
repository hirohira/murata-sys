'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { Project, ReportType, ReportFinding } from '@/types';

export default function NewReportPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-murata-primary border-t-transparent rounded-full" /></div>}>
      <NewReportContent />
    </Suspense>
  );
}

function NewReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedProjectId = searchParams.get('projectId');
  const preselectedType = searchParams.get('type') as ReportType | null;

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState(preselectedProjectId || '');
  const [reportType, setReportType] = useState<ReportType>(preselectedType || '調査報告書');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Generated report data
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [findings, setFindings] = useState<ReportFinding[]>([]);
  const [recommendation, setRecommendation] = useState('');
  const [generated, setGenerated] = useState(false);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await fetch('/api/projects');
        const { data } = await res.json();
        setProjects(data || []);
      } catch (err) {
        console.error('Failed to fetch projects:', err);
      }
    };
    fetchProjects();
  }, []);

  const selectedProject = projects.find((p) => p.id === projectId);

  const handleGenerate = async () => {
    if (!projectId) {
      setError('案件を選択してください');
      return;
    }

    setGenerating(true);
    setError('');

    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, report_type: reportType }),
      });

      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || '生成に失敗しました');
      }

      const data = await res.json();
      setTitle(data.title || '');
      setSummary(data.summary || '');
      setFindings(data.findings || []);
      setRecommendation(data.recommendation || '');
      setGenerated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成に失敗しました');
    } finally {
      setGenerating(false);
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
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          report_type: reportType,
          title,
          summary,
          findings,
          recommendation,
          generated_by_ai: true,
          status: '下書き',
        }),
      });

      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || '保存に失敗しました');
      }

      const { data } = await res.json();
      router.push(`/reports/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました');
      setSaving(false);
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
        severity: '経過観察' as const,
        recommendation: '',
      },
    ]);
  };

  return (
    <div className="max-w-3xl mx-auto pb-24">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-500 mb-4">
        <Link href="/reports" className="hover:text-murata-primary">
          報告書
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">新規作成</span>
      </div>

      <h2 className="text-lg font-bold text-gray-900 mb-5">報告書作成</h2>

      {/* Step 1: 案件・種別選択 */}
      {!generated && (
        <div className="space-y-5">
          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold text-sm">案件選択</h3>
            </div>
            <div className="card-body">
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="form-select"
              >
                <option value="">案件を選択してください</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.customer_name} - {p.site_name}
                  </option>
                ))}
              </select>
              {selectedProject && (
                <p className="text-xs text-gray-500 mt-2 font-mono">
                  {selectedProject.project_id} / {selectedProject.construction_type}
                </p>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold text-sm">報告書種別</h3>
            </div>
            <div className="card-body">
              <div className="flex gap-3">
                {(['調査報告書', '完了報告書'] as ReportType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setReportType(type)}
                    className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-colors ${
                      reportType === type
                        ? 'border-murata-primary bg-murata-primary/5 text-murata-primary'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {type === '調査報告書' ? '🔍' : '✅'} {type}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="btn btn-secondary"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || !projectId}
              className="btn btn-primary"
            >
              {generating ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  AI生成中...
                </span>
              ) : (
                '🤖 AIで報告書を生成'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: 生成結果の編集 */}
      {generated && (
        <div className="space-y-5">
          <div className="bg-blue-50 text-blue-800 text-sm px-4 py-3 rounded-lg flex items-center gap-2">
            <span>🤖</span>
            <span>AIが生成した内容です。必要に応じて編集してから保存してください。</span>
          </div>

          {/* タイトル */}
          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold text-sm">タイトル</h3>
            </div>
            <div className="card-body">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="form-input"
                placeholder="報告書タイトル"
              />
            </div>
          </div>

          {/* 概要 */}
          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold text-sm">
                {reportType === '調査報告書' ? '調査概要' : '工事概要'}
              </h3>
            </div>
            <div className="card-body">
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={5}
                className="form-textarea"
                placeholder="概要を入力..."
              />
            </div>
          </div>

          {/* 所見一覧 */}
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h3 className="font-semibold text-sm">
                {reportType === '調査報告書' ? '所見一覧' : '施工内容'}
              </h3>
              <button
                type="button"
                onClick={addFinding}
                className="text-xs text-murata-primary hover:underline"
              >
                + 項目追加
              </button>
            </div>
            <div className="card-body space-y-4">
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
                      {reportType === '調査報告書' ? '所見' : '施工内容'}
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
                        {reportType === '調査報告書' ? '重要度' : '状態'}
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
          </div>

          {/* 総合推奨事項 */}
          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold text-sm">総合推奨事項</h3>
            </div>
            <div className="card-body">
              <textarea
                value={recommendation}
                onChange={(e) => setRecommendation(e.target.value)}
                rows={4}
                className="form-textarea"
                placeholder="総合的な推奨事項..."
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setGenerated(false);
                setTitle('');
                setSummary('');
                setFindings([]);
                setRecommendation('');
              }}
              className="btn btn-secondary"
            >
              やり直す
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary"
            >
              {saving ? '保存中...' : '報告書を保存'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
