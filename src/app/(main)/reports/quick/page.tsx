'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import VoiceRecorder from '@/components/VoiceRecorder';
import type { Project, ReportType } from '@/types';

interface PhotoInfo {
  total: number;
  summary: { label: string; count: number }[];
  photoFolderUrl: string | null;
  driveConfigured: boolean;
  driveError: string | null;
}

interface Result {
  id: string;
  chapters: number;
  photosAvailable: number;
  photosUsed: number;
  photosFailed: number;
  drive: { url: string; name: string } | null;
  driveError: string | null;
}

const EXAMPLE: Record<ReportType, string> = {
  調査報告書:
    '例）現状は、南面の屋根材にひび割れと色あせ、東側の雨樋の外れを確認できた。原因は、1つ目が経年劣化による屋根材の防水性の低下、2つ目が棟板金の釘の浮き。対策として、屋根カバー工法と雨樋の交換を提案したい。',
  完了報告書:
    '例）施工前は棟板金が浮き、雨水が入る状態だった。原因は下地の貫板の腐食。施工内容は、貫板を樹脂製に交換し、棟板金をビスで固定し直した。施工後は浮きがなくなり、シーリングも打ち替えた。',
};

const STEPS = ['写真を集めて、AIが章立てと文章を作っています', 'ドライブの写真を報告書に取り込んでいます', '報告書を保存しています', 'PowerPointを作ってドライブに保存しています'];

function QuickReport() {
  const params = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState(params.get('projectId') || '');
  const [reportType, setReportType] = useState<ReportType>('調査報告書');
  const [scenario, setScenario] = useState('');
  const [info, setInfo] = useState<PhotoInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((j) => setProjects(j.data || []))
      .catch(() => setProjects([]));
  }, []);

  const loadInfo = () => {
    if (!projectId) {
      setInfo(null);
      return;
    }
    setInfoLoading(true);
    fetch(`/api/reports/quick?projectId=${projectId}&type=${encodeURIComponent(reportType)}`)
      .then((r) => r.json())
      .then((j) => setInfo(j.data ?? null))
      .catch(() => setInfo(null))
      .finally(() => setInfoLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(loadInfo, [projectId, reportType]);

  const [progress, setProgress] = useState('');

  const postJson = async (url: string, body?: unknown) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const reason = res.status === 504 ? '時間内に終わりませんでした' : json.error;
      throw new Error(reason || `失敗しました（${res.status}）`);
    }
    return json.data;
  };

  // 1回の処理が長くなりすぎないよう、4つの手順に分けて順に進める
  const run = async () => {
    if (!projectId) return;
    setRunning(true);
    setError('');
    setResult(null);
    setProgress('');
    let current = 0;
    try {
      // 手順1：写真を集め、AIが章立て・写真の割り当て・文章を決める
      setStep((current = 0));
      const planned = await postJson('/api/reports/quick', { project_id: projectId, report_type: reportType, scenario });
      const photos: { key: string; source: string; driveFileId?: string; url?: string; path?: string }[] = planned.photos;

      // 手順2：使うドライブの写真だけ、報告書用に取り込む（3枚ずつ）
      setStep((current = 1));
      const drivePhotos = photos.filter((p) => p.source === 'drive' && p.driveFileId);
      let done = 0;
      let cursor = 0;
      const worker = async () => {
        while (cursor < drivePhotos.length) {
          const ph = drivePhotos[cursor++];
          try {
            const d = await postJson(`/api/projects/${projectId}/drive-photos`, { fileId: ph.driveFileId });
            ph.url = d.url;
            ph.path = d.path;
          } catch {
            // 取り込めなかった写真は外す（報告書は作る）
          }
          done++;
          setProgress(`${done} / ${drivePhotos.length}枚`);
        }
      };
      await Promise.all(Array.from({ length: Math.min(3, drivePhotos.length) }, worker));
      setProgress('');

      // 手順3：報告書を保存
      setStep((current = 2));
      const saved = await postJson('/api/reports/quick/finalize', {
        project_id: projectId,
        report_type: reportType,
        scenario,
        plan: planned.plan,
        photos,
      });

      // 手順4：PowerPointを作ってドライブに保存（失敗しても報告書はできている）
      setStep((current = 3));
      let drive: Result['drive'] = null;
      let driveError: string | null = null;
      if (info?.driveConfigured !== false) {
        try {
          const d = await postJson(`/api/reports/${saved.id}/drive`);
          drive = { url: d.url, name: d.name };
        } catch (e) {
          driveError = e instanceof Error ? e.message : 'ドライブへの保存に失敗しました';
        }
      }

      setResult({
        id: saved.id,
        chapters: saved.chapters,
        photosAvailable: planned.photosAvailable,
        photosUsed: saved.photosUsed,
        photosFailed: saved.photosFailed,
        drive,
        driveError,
      });
    } catch (e) {
      setError(`「${STEPS[current]}」の途中で失敗しました：${e instanceof Error ? e.message : 'エラー'}`);
    } finally {
      setRunning(false);
    }
  };

  const project = projects.find((p) => p.id === projectId);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="text-sm text-gray-500">
        <Link href="/reports" className="hover:text-murata-primary">
          報告書
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">かんたん作成</span>
      </div>
      <div>
        <h2 className="text-lg font-bold text-gray-900">報告書をかんたん作成</h2>
        <p className="mt-1 text-sm text-gray-600">
          写真を区分ごとのフォルダに入れ、伝えたい流れ（シナリオ）を書いてボタンを押すと、PowerPointの報告書ができます。仕上げはPowerPointで行ってください。
        </p>
      </div>

      {/* 1. 案件と種類 */}
      <div className="card">
        <div className="card-body space-y-4">
          <div>
            <label htmlFor="qr-project" className="form-label">
              ① 案件
            </label>
            <select id="qr-project" className="form-select" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
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
        </div>
      </div>

      {/* 2. 写真 */}
      {projectId && (
        <div className="card">
          <div className="card-body space-y-3">
            <p className="form-label mb-0">② 写真</p>
            {infoLoading ? (
              <p className="text-sm text-gray-500">写真を確認しています…</p>
            ) : info ? (
              <>
                {info.total > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {info.summary.map((s) => (
                      <span key={s.label} className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-800">
                        {s.label} <span className="font-semibold tabular-nums">{s.count}</span>枚
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">まだ写真がありません。</p>
                )}
                <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700 space-y-1.5">
                  <p>
                    写真は、案件の「写真」タブで撮るか、Googleドライブの現場フォルダ「03_現場調査」の中の
                    <strong>「現状」「原因」「対策」「その他」</strong>フォルダに入れてください。
                  </p>
                  <p>
                    原因が2つ以上あるときは「原因」フォルダの中に<strong>「原因1」「原因2」</strong>
                    のフォルダを作るか、ファイル名の頭を「原因1_」「原因2_」にすると、その原因のページに入ります。
                  </p>
                  {info.photoFolderUrl && (
                    <a href={info.photoFolderUrl} target="_blank" rel="noreferrer" className="inline-block text-murata-primary underline">
                      写真フォルダ（03_現場調査）を開く
                    </a>
                  )}
                  {info.driveError && <p className="text-red-600">ドライブの写真を読み込めませんでした：{info.driveError}</p>}
                </div>
                <button type="button" onClick={loadInfo} className="text-sm text-murata-primary hover:underline">
                  写真の枚数を数え直す
                </button>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* 3. シナリオ */}
      {projectId && (
        <div className="card">
          <div className="card-body space-y-3">
            <p className="form-label mb-0">③ シナリオ（報告書で伝えたい流れ）</p>
            <p className="text-xs text-gray-500">「現状は〜、原因は1つ目が〜、2つ目が〜、対策として〜を提案したい」のように書くか、話してください。</p>
            <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">{EXAMPLE[reportType]}</p>
            <VoiceRecorder value={scenario} onChange={setScenario} />
          </div>
        </div>
      )}

      {projectId && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={run}
            disabled={running || (!scenario.trim() && !(info && info.total > 0))}
            className="btn btn-primary w-full py-3 text-base"
          >
            {running ? '作成中…' : `${reportType}を作成する`}
          </button>
          {running && (
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700" aria-live="polite">
              <ol className="space-y-1">
                {STEPS.map((s, i) => (
                  <li key={s} className={i < step ? 'text-gray-400' : i === step ? 'font-semibold text-murata-primary' : 'text-gray-400'}>
                    {i < step ? '✓ ' : i === step ? '… ' : '　 '}
                    {s}
                    {i === step && progress ? `（${progress}）` : ''}
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-xs text-gray-500">写真の枚数により1〜2分ほどかかります。画面を閉じずにお待ちください。</p>
            </div>
          )}
          {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        </div>
      )}

      {result && (
        <div className="card border-2 border-murata-primary">
          <div className="card-body space-y-3">
            <h3 className="font-bold text-gray-900">報告書ができました</h3>
            <p className="text-sm text-gray-700">
              {project ? `${project.customer_name} - ${project.site_name}　` : ''}
              {result.chapters}章・写真{result.photosUsed}枚（使える写真{result.photosAvailable}枚）
            </p>
            {result.photosFailed > 0 && (
              <p className="text-sm text-amber-700">写真{result.photosFailed}枚を取り込めなかったため、外しています。</p>
            )}
            {result.driveError && <p className="text-sm text-red-600">ドライブへの保存に失敗しました：{result.driveError}</p>}
            <div className="grid gap-2 sm:grid-cols-3">
              {result.drive && (
                <a href={result.drive.url} target="_blank" rel="noreferrer" className="btn btn-primary">
                  ドライブで開く
                </a>
              )}
              <a href={`/api/reports/${result.id}/export`} className="btn btn-secondary">
                PowerPointをダウンロード
              </a>
              <Link href={`/reports/${result.id}`} className="btn btn-secondary">
                内容を確認・修正
              </Link>
            </div>
            <p className="text-xs text-gray-500">
              直したいときは、シナリオを書き換えてもう一度作成するか、PowerPointで直接直してください。
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function QuickReportPage() {
  return (
    <Suspense fallback={null}>
      <QuickReport />
    </Suspense>
  );
}
