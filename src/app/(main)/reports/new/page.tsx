'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import WizardStepper from '@/components/reports/WizardStepper';
import ChapterEditor from '@/components/reports/ChapterEditor';
import DrivePhotoPicker from '@/components/reports/DrivePhotoPicker';
import VoiceRecorder from '@/components/VoiceRecorder';
import type {
  Project,
  ReportType,
  ReportChapter,
  ChapterPhoto,
  InputPattern,
  ReportStyle,
  AudienceType,
  ReportMeta,
  PhotoTag,
  ConstructionType,
  BuildingType,
} from '@/types';
import { hasChapterContent } from '@/lib/chapter-numbering';
import {
  getChapterTemplate,
  DEFAULT_WORK_HOURS,
  AUDIENCE_TYPES,
  BUILDING_TYPES,
} from '@/lib/constants';

export default function NewReportPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-murata-primary border-t-transparent rounded-full" />
        </div>
      }
    >
      <NewReportWizard />
    </Suspense>
  );
}

const WIZARD_STEPS = [
  { number: 1, label: '方式選択' },
  { number: 2, label: '基本情報' },
  { number: 3, label: '章立て・写真' },
  { number: 4, label: 'AI生成' },
];

// Helper to generate unique IDs
let _idCounter = 0;
function genId() {
  _idCounter += 1;
  return `${Date.now()}-${_idCounter}`;
}

function createDefaultChapters(
  reportType: ReportType,
  buildingType?: BuildingType | null,
  constructionType?: ConstructionType | null
): ReportChapter[] {
  const templates = getChapterTemplate(reportType, buildingType, constructionType);

  return templates.map((t, i) => ({
    id: genId(),
    title: t.title,
    key: t.key,
    photos: [],
    description: '',
    ai_generated: false,
    sort_order: i,
  }));
}

function NewReportWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedProjectId = searchParams.get('projectId');
  const preselectedType = searchParams.get('type') as ReportType | null;

  // Wizard state
  const [step, setStep] = useState(1);

  // Step 1: 方式選択
  const [inputPattern, setInputPattern] = useState<InputPattern>('onsite');
  const [reportType, setReportType] = useState<ReportType>(
    preselectedType || '調査報告書'
  );

  // Step 2: 基本情報
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState(preselectedProjectId || '');
  // 報告書様式は茂様式に統一
  const reportStyle: ReportStyle = '茂様式';
  const [audienceType, setAudienceType] = useState<AudienceType>('一般施主向け');
  const [surveyDate, setSurveyDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [addressee, setAddressee] = useState('');
  const [constructionName, setConstructionName] = useState('');
  const [purpose, setPurpose] = useState('');
  // 「工事日数・特記事項」ページ（調査報告書）
  const [scheduleInfo, setScheduleInfo] = useState<ScheduleInfo>({
    estimate_no: '',
    work_days: '',
    work_hours: DEFAULT_WORK_HOURS,
    staff_name: '',
    staff_tel: '',
  });

  // Step 3: 章立て・写真
  const [chapters, setChapters] = useState<ReportChapter[]>(() =>
    createDefaultChapters(reportType)
  );
  const [activeChapterIdx, setActiveChapterIdx] = useState(0);

  // Step 4: AI生成
  const [generating, setGenerating] = useState(false);
  const [generatingChapter, setGeneratingChapter] = useState('');
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationDone, setGenerationDone] = useState(false);

  // General
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Fetch projects
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/projects');
        const { data } = await res.json();
        setProjects(data || []);
      } catch (err) {
        console.error('Failed to fetch projects:', err);
      }
    })();
  }, []);

  const selectedProject = projects.find((p) => p.id === projectId);
  const constructionType = selectedProject?.construction_type ?? null;
  const buildingType = selectedProject?.building_type ?? null;

  // 章立てを手で編集した（追加・削除・名前変更・並べ替え）か
  const chaptersEditedRef = useRef(false);

  // 報告書種別・工事種別に合わせて章立てのひな形を切り替える。
  // 写真や説明文を入力済み、または章を手で編集済みの場合は上書きしない。
  useEffect(() => {
    setChapters((prev) => {
      if (chaptersEditedRef.current || prev.some(hasChapterContent)) return prev;
      return createDefaultChapters(reportType, buildingType, constructionType);
    });
    setActiveChapterIdx(0);
  }, [reportType, buildingType, constructionType]);

  // Populate fields from selected project
  useEffect(() => {
    if (selectedProject) {
      setAudienceType(selectedProject.audience_type);
      if (!constructionName) {
        setConstructionName(
          `${selectedProject.customer_name} ${selectedProject.site_name} ${selectedProject.construction_type}`
        );
      }
    }
  }, [selectedProject]);

  // Chapter photo handlers
  const handleAddPhoto = useCallback(
    (chapterId: string, file: File) => {
      const preview = URL.createObjectURL(file);
      const newPhoto: ChapterPhoto = {
        id: genId(),
        file,
        preview,
        caption: '',
        sort_order: 0,
      };
      setChapters((prev) =>
        prev.map((ch) =>
          ch.id === chapterId
            ? {
                ...ch,
                photos: [
                  ...ch.photos,
                  { ...newPhoto, sort_order: ch.photos.length },
                ],
              }
            : ch
        )
      );
    },
    []
  );

  // ドライブから取り込んだ写真（アップロード済み）を章に追加
  const handleAddImportedPhotos = useCallback(
    (chapterId: string, photos: ChapterPhoto[]) => {
      setChapters((prev) =>
        prev.map((ch) =>
          ch.id === chapterId
            ? {
                ...ch,
                photos: [
                  ...ch.photos,
                  ...photos.map((p, i) => ({ ...p, sort_order: ch.photos.length + i })),
                ],
              }
            : ch
        )
      );
    },
    []
  );

  const handleRemovePhoto = useCallback(
    (chapterId: string, photoId: string) => {
      setChapters((prev) =>
        prev.map((ch) =>
          ch.id === chapterId
            ? { ...ch, photos: ch.photos.filter((p) => p.id !== photoId) }
            : ch
        )
      );
    },
    []
  );

  const handleUpdatePhotoCaption = useCallback(
    (chapterId: string, photoId: string, caption: string) => {
      setChapters((prev) =>
        prev.map((ch) =>
          ch.id === chapterId
            ? {
                ...ch,
                photos: ch.photos.map((p) =>
                  p.id === photoId ? { ...p, caption } : p
                ),
              }
            : ch
        )
      );
    },
    []
  );

  const handleUpdatePhotoTag = useCallback(
    (chapterId: string, photoId: string, tag: PhotoTag) => {
      setChapters((prev) =>
        prev.map((ch) =>
          ch.id === chapterId
            ? {
                ...ch,
                photos: ch.photos.map((p) =>
                  p.id === photoId ? { ...p, tag } : p
                ),
              }
            : ch
        )
      );
    },
    []
  );

  const handleUpdateChapter = useCallback((updated: ReportChapter) => {
    setChapters((prev) =>
      prev.map((ch) => {
        if (ch.id !== updated.id) return ch;
        if (ch.title !== updated.title) chaptersEditedRef.current = true;
        return updated;
      })
    );
  }, []);

  // 章を追加（選択中の章の直後に挿入）
  const addChapter = useCallback(() => {
    chaptersEditedRef.current = true;
    const insertAt = activeChapterIdx + 1;
    setChapters((prev) => {
      const next = [...prev];
      next.splice(insertAt, 0, {
        id: genId(),
        title: '新しい章',
        key: `custom_${genId()}`,
        photos: [],
        description: '',
        ai_generated: false,
        sort_order: 0,
      });
      return next.map((ch, i) => ({ ...ch, sort_order: i }));
    });
    setActiveChapterIdx(insertAt);
  }, [activeChapterIdx]);

  // 章を削除
  const removeChapter = useCallback(
    (idx: number) => {
      const target = chapters[idx];
      if (!target || chapters.length <= 1) return;
      if (
        hasChapterContent(target) &&
        !confirm(`「${target.title}」には写真や説明文が入っています。削除しますか？`)
      ) {
        return;
      }
      chaptersEditedRef.current = true;
      setChapters((prev) =>
        prev.filter((_, i) => i !== idx).map((ch, i) => ({ ...ch, sort_order: i }))
      );
      setActiveChapterIdx((prev) => Math.max(0, Math.min(prev, chapters.length - 2)));
    },
    [chapters]
  );

  // ひな形に戻す
  const resetChapters = useCallback(() => {
    if (
      chapters.some(hasChapterContent) &&
      !confirm('入力した写真・説明文も消えます。章立てをひな形に戻しますか？')
    ) {
      return;
    }
    chaptersEditedRef.current = false;
    setChapters(createDefaultChapters(reportType, buildingType, constructionType));
    setActiveChapterIdx(0);
  }, [chapters, reportType, buildingType, constructionType]);

  // Move chapter up/down
  const moveChapter = useCallback((idx: number, direction: -1 | 1) => {
    chaptersEditedRef.current = true;
    setChapters((prev) => {
      const newChapters = [...prev];
      const targetIdx = idx + direction;
      if (targetIdx < 0 || targetIdx >= newChapters.length) return prev;
      [newChapters[idx], newChapters[targetIdx]] = [
        newChapters[targetIdx],
        newChapters[idx],
      ];
      return newChapters.map((ch, i) => ({ ...ch, sort_order: i }));
    });
    setActiveChapterIdx((prev) => {
      const target = prev + direction;
      if (target < 0) return prev;
      return target;
    });
  }, []);

  // Validate step before advancing
  const canAdvance = (): boolean => {
    setError('');
    if (step === 1) return true;
    if (step === 2) {
      if (!projectId) {
        setError('案件を選択してください');
        return false;
      }
      return true;
    }
    if (step === 3) {
      // Must have at least some photos or descriptions
      const hasContent = chapters.some(
        (ch) => ch.photos.length > 0 || ch.description.trim()
      );
      if (!hasContent) {
        setError('少なくとも1つの章に写真または説明を追加してください');
        return false;
      }
      return true;
    }
    return true;
  };

  const nextStep = () => {
    if (canAdvance()) {
      setStep((s) => Math.min(s + 1, 4));
      if (step === 3) {
        // Entering step 4 — start AI generation
        startAIGeneration();
      }
    }
  };

  const prevStep = () => {
    setError('');
    setStep((s) => Math.max(s - 1, 1));
  };

  // Upload photos to Supabase Storage
  const uploadChapterPhotos = async (): Promise<ReportChapter[]> => {
    const uploadedChapters = [...chapters];

    for (const chapter of uploadedChapters) {
      for (let i = 0; i < chapter.photos.length; i++) {
        const photo = chapter.photos[i];
        if (photo.file && !photo.url) {
          try {
            const formData = new FormData();
            formData.append('file', photo.file);
            formData.append('project_id', projectId);
            formData.append('category', chapter.key);
            const res = await fetch('/api/upload', {
              method: 'POST',
              body: formData,
            });
            if (res.ok) {
              const { url, path } = await res.json();
              chapter.photos[i] = {
                ...photo,
                url,
                path,
                file: undefined,
                preview: undefined,
              };
            }
          } catch (err) {
            console.error('Photo upload failed:', err);
          }
        }
      }
    }

    return uploadedChapters;
  };

  // AI Generation
  const startAIGeneration = async () => {
    setGenerating(true);
    setGenerationProgress(0);
    setGenerationDone(false);

    try {
      // Upload photos first
      setGeneratingChapter('写真アップロード中...');
      const uploadedChapters = await uploadChapterPhotos();

      // Generate descriptions for each chapter with content
      const chaptersWithContent = uploadedChapters.filter(
        (ch) => ch.photos.length > 0 || ch.description.trim()
      );
      const total = chaptersWithContent.length || 1;

      for (let i = 0; i < chaptersWithContent.length; i++) {
        const ch = chaptersWithContent[i];
        setGeneratingChapter(ch.title);
        setGenerationProgress(Math.round(((i + 0.5) / total) * 100));

        // Only generate if no manual description
        if (!ch.description.trim() && ch.photos.length > 0) {
          try {
            const res = await fetch('/api/reports/generate-chapter', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                project_id: projectId,
                report_type: reportType,
                chapter_key: ch.key,
                chapter_title: ch.title,
                photo_captions: ch.photos.map((p) => p.caption).filter(Boolean),
                audience_type: audienceType,
              }),
            });

            if (res.ok) {
              const { description } = await res.json();
              const idx = uploadedChapters.findIndex(
                (c) => c.id === ch.id
              );
              if (idx >= 0) {
                uploadedChapters[idx] = {
                  ...uploadedChapters[idx],
                  description: description || uploadedChapters[idx].description,
                  ai_generated: true,
                };
              }
            }
          } catch (err) {
            console.error(`AI generation for ${ch.title} failed:`, err);
          }
        }

        setGenerationProgress(Math.round(((i + 1) / total) * 100));
      }

      setChapters(uploadedChapters);
      setGenerationProgress(100);
      setGeneratingChapter('完了');
      setGenerationDone(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'AI生成に失敗しました'
      );
    } finally {
      setGenerating(false);
    }
  };

  // Save report
  const handleSave = async () => {
    setSaving(true);
    setError('');

    try {
      // Build title
      const title =
        constructionName ||
        `${selectedProject?.customer_name || ''} ${reportType}`;

      // Clean chapters for storage (remove File objects)
      const cleanChapters = chapters.map((ch) => ({
        ...ch,
        photos: ch.photos.map((p) => ({
          id: p.id,
          url: p.url || '',
          path: p.path || '',
          caption: p.caption,
          sort_order: p.sort_order,
          ...(p.tag ? { tag: p.tag } : {}),
        })),
      }));

      const meta: ReportMeta = {
        input_pattern: inputPattern,
        report_style: reportStyle,
        survey_date: surveyDate,
        addressee: addressee || undefined,
        construction_name: constructionName || undefined,
        purpose: purpose || undefined,
        ...(reportType === '調査報告書'
          ? Object.fromEntries(
              Object.entries(scheduleInfo).filter(([, v]) => v.trim() !== '')
            )
          : {}),
      };

      // Build summary from chapter descriptions
      const summary = cleanChapters
        .filter((ch) => ch.description)
        .map((ch) => `【${ch.title}】${ch.description}`)
        .join('\n\n');

      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          report_type: reportType,
          title,
          summary,
          chapters: cleanChapters,
          meta,
          findings: [],
          recommendation: '',
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

  return (
    <div className="max-w-4xl mx-auto pb-24">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-500 mb-4">
        <Link href="/reports" className="hover:text-murata-primary">
          報告書
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">新規作成</span>
      </div>

      <h2 className="text-lg font-bold text-gray-900 mb-2">
        {reportType}作成
      </h2>

      {/* Stepper */}
      <WizardStepper
        steps={WIZARD_STEPS}
        currentStep={step}
        onStepClick={(s) => {
          if (s < step) setStep(s);
        }}
      />

      {/* Error display */}
      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* Step 1: 方式選択 */}
      {step === 1 && (
        <Step1PatternSelect
          inputPattern={inputPattern}
          setInputPattern={setInputPattern}
          reportType={reportType}
          setReportType={setReportType}
        />
      )}

      {/* Step 2: 基本情報 */}
      {step === 2 && (
        <Step2BasicInfo
          projects={projects}
          projectId={projectId}
          setProjectId={setProjectId}
          selectedProject={selectedProject}
          audienceType={audienceType}
          setAudienceType={setAudienceType}
          surveyDate={surveyDate}
          setSurveyDate={setSurveyDate}
          addressee={addressee}
          setAddressee={setAddressee}
          constructionName={constructionName}
          setConstructionName={setConstructionName}
          purpose={purpose}
          setPurpose={setPurpose}
          scheduleInfo={scheduleInfo}
          setScheduleInfo={setScheduleInfo}
          reportType={reportType}
        />
      )}

      {/* Step 3: 章立て・写真 */}
      {step === 3 && (
        <Step3Chapters
          chapters={chapters}
          activeChapterIdx={activeChapterIdx}
          setActiveChapterIdx={setActiveChapterIdx}
          onUpdateChapter={handleUpdateChapter}
          onAddPhoto={handleAddPhoto}
          onRemovePhoto={handleRemovePhoto}
          onUpdatePhotoCaption={handleUpdatePhotoCaption}
          onUpdatePhotoTag={handleUpdatePhotoTag}
          onMoveChapter={moveChapter}
          onAddChapter={addChapter}
          onAddImportedPhotos={handleAddImportedPhotos}
          projectId={projectId}
          onRemoveChapter={removeChapter}
          onResetChapters={resetChapters}
          templateLabel={`${reportType}・${buildingType ?? '住宅'}${constructionType === '雨漏り調査' ? '・雨漏り' : ''}`}
          isCompletionReport={reportType === '完了報告書'}
        />
      )}

      {/* Step 4: AI生成 */}
      {step === 4 && (
        <Step4Generation
          chapters={chapters}
          generatingChapter={generatingChapter}
          generationProgress={generationProgress}
          generationDone={generationDone}
          generating={generating}
        />
      )}

      {/* Navigation buttons */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
        <div>
          {step > 1 && step < 4 && (
            <button
              type="button"
              onClick={prevStep}
              className="btn btn-secondary"
            >
              戻る
            </button>
          )}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="btn btn-secondary"
          >
            キャンセル
          </button>
          {step < 3 && (
            <button
              type="button"
              onClick={nextStep}
              className="btn btn-primary"
            >
              次へ
            </button>
          )}
          {step === 3 && (
            <button
              type="button"
              onClick={nextStep}
              className="btn btn-accent"
            >
              AI生成開始
            </button>
          )}
          {step === 4 && generationDone && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary"
            >
              {saving ? '保存中...' : '報告書を保存'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Step 1: 方式選択 ─────────────────────────────
function Step1PatternSelect({
  inputPattern,
  setInputPattern,
  reportType,
  setReportType,
}: {
  inputPattern: InputPattern;
  setInputPattern: (p: InputPattern) => void;
  reportType: ReportType;
  setReportType: (t: ReportType) => void;
}) {
  return (
    <div className="space-y-5">
      {/* Report type */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-sm">報告書種別</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                { type: '調査報告書' as ReportType, icon: '🔍', desc: '現場調査の結果を報告' },
                { type: '完了報告書' as ReportType, icon: '✅', desc: '工事完了の報告' },
              ] as const
            ).map(({ type, icon, desc }) => (
              <button
                key={type}
                type="button"
                onClick={() => setReportType(type)}
                className={`p-4 rounded-xl border-2 text-left transition-colors ${
                  reportType === type
                    ? 'border-murata-primary bg-murata-primary/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="text-2xl">{icon}</span>
                <p className="text-sm font-bold text-gray-900 mt-2">{type}</p>
                <p className="text-xs text-gray-500 mt-1">{desc}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Input pattern */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-sm">入力方式</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setInputPattern('onsite')}
              className={`p-4 rounded-xl border-2 text-left transition-colors ${
                inputPattern === 'onsite'
                  ? 'border-murata-primary bg-murata-primary/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">📱</span>
                <div>
                  <p className="text-sm font-bold text-gray-900">
                    パターン1: 現場入力
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    スマホで写真撮影・音声入力しながら作成
                  </p>
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setInputPattern('office')}
              className={`p-4 rounded-xl border-2 text-left transition-colors ${
                inputPattern === 'office'
                  ? 'border-murata-primary bg-murata-primary/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">💻</span>
                <div>
                  <p className="text-sm font-bold text-gray-900">
                    パターン2: 帰社後PC入力
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    写真をまとめてアップロードし編集
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step 2: 基本情報 ─────────────────────────────
function Step2BasicInfo({
  projects,
  projectId,
  setProjectId,
  selectedProject,
  audienceType,
  setAudienceType,
  surveyDate,
  setSurveyDate,
  addressee,
  setAddressee,
  constructionName,
  setConstructionName,
  purpose,
  setPurpose,
  scheduleInfo,
  setScheduleInfo,
  reportType,
}: {
  projects: Project[];
  projectId: string;
  setProjectId: (id: string) => void;
  selectedProject?: Project;
  audienceType: AudienceType;
  setAudienceType: (t: AudienceType) => void;
  surveyDate: string;
  setSurveyDate: (d: string) => void;
  addressee: string;
  setAddressee: (a: string) => void;
  constructionName: string;
  setConstructionName: (n: string) => void;
  purpose: string;
  setPurpose: (p: string) => void;
  scheduleInfo: ScheduleInfo;
  setScheduleInfo: (s: ScheduleInfo) => void;
  reportType: ReportType;
}) {
  return (
    <div className="space-y-4">
      {/* 案件選択 */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-sm">案件選択 <span className="text-red-500">*</span></h3>
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
                {p.customer_name} - {p.site_name} ({p.construction_type})
              </option>
            ))}
          </select>
          {selectedProject && (
            <div className="mt-2 text-xs text-gray-500 space-y-0.5">
              <p>現場ID: <span className="font-mono">{selectedProject.project_id}</span></p>
              <p>住所: {selectedProject.address || '未登録'}</p>
              <p>建物種別: {selectedProject.building_type}</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {/* 読み手 */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-sm">読み手</h3>
          </div>
          <div className="card-body">
            <div className="flex gap-2">
              {AUDIENCE_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setAudienceType(type)}
                  className={`flex-1 py-2.5 px-3 rounded-lg border-2 text-sm transition-colors ${
                    audienceType === type
                      ? 'border-murata-primary bg-murata-primary/5 text-murata-primary font-medium'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* 調査日 / 施工日 */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-sm">
              {reportType === '調査報告書' ? '調査日' : '施工完了日'}
            </h3>
          </div>
          <div className="card-body">
            <input
              type="date"
              value={surveyDate}
              onChange={(e) => setSurveyDate(e.target.value)}
              className="form-input"
            />
          </div>
        </div>

        {/* 宛先 */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-sm">宛先</h3>
          </div>
          <div className="card-body">
            <input
              type="text"
              value={addressee}
              onChange={(e) => setAddressee(e.target.value)}
              placeholder="例：○○様"
              className="form-input"
            />
          </div>
        </div>
      </div>

      {/* 工事名称 */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-sm">工事名称</h3>
        </div>
        <div className="card-body">
          <input
            type="text"
            value={constructionName}
            onChange={(e) => setConstructionName(e.target.value)}
            placeholder="例：○○邸 屋根改修工事"
            className="form-input"
          />
        </div>
      </div>

      {/* 目的・備考 */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-sm">目的・備考</h3>
        </div>
        <div className="card-body">
          <textarea
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="調査・工事の目的や備考..."
            rows={3}
            className="form-textarea"
          />
        </div>
      </div>

      {/* 工事日数・特記事項（調査報告書の最後から2ページ目） */}
      {reportType === '調査報告書' && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-sm">工事日数・特記事項ページ</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              報告書の最後から2ページ目に入ります。空欄でも出力され、特記事項の定型文は自動で入ります。
            </p>
          </div>
          <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(
              [
                { key: 'estimate_no', label: '見積番号', placeholder: '例：19901' },
                { key: 'work_days', label: '工事日数', placeholder: '例：3日～4日' },
                { key: 'work_hours', label: '作業時間', placeholder: '例：8：30～17：00' },
                { key: 'staff_name', label: '担当者', placeholder: '空欄なら作成者の名前' },
                { key: 'staff_tel', label: '担当者TEL', placeholder: '例：080-0000-0000' },
              ] as const
            ).map((f) => (
              <div key={f.key}>
                <label htmlFor={`schedule-${f.key}`} className="form-label">
                  {f.label}
                </label>
                <input
                  id={`schedule-${f.key}`}
                  type="text"
                  value={scheduleInfo[f.key]}
                  onChange={(e) => setScheduleInfo({ ...scheduleInfo, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  className="form-input"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface ScheduleInfo {
  estimate_no: string;
  work_days: string;
  work_hours: string;
  staff_name: string;
  staff_tel: string;
}

// ─── Step 3: 章立て・写真 ─────────────────────────
function Step3Chapters({
  chapters,
  activeChapterIdx,
  setActiveChapterIdx,
  onUpdateChapter,
  onAddPhoto,
  onRemovePhoto,
  onUpdatePhotoCaption,
  onUpdatePhotoTag,
  onMoveChapter,
  onAddChapter,
  onAddImportedPhotos,
  projectId,
  onRemoveChapter,
  onResetChapters,
  templateLabel,
  isCompletionReport,
}: {
  chapters: ReportChapter[];
  activeChapterIdx: number;
  setActiveChapterIdx: (i: number) => void;
  onUpdateChapter: (ch: ReportChapter) => void;
  onAddPhoto: (chapterId: string, file: File) => void;
  onRemovePhoto: (chapterId: string, photoId: string) => void;
  onUpdatePhotoCaption: (chapterId: string, photoId: string, caption: string) => void;
  onUpdatePhotoTag: (chapterId: string, photoId: string, tag: PhotoTag) => void;
  onMoveChapter: (idx: number, direction: -1 | 1) => void;
  onAddChapter: () => void;
  onAddImportedPhotos: (chapterId: string, photos: ChapterPhoto[]) => void;
  projectId: string;
  onRemoveChapter: (idx: number) => void;
  onResetChapters: () => void;
  templateLabel: string;
  isCompletionReport: boolean;
}) {
  const activeChapter = chapters[activeChapterIdx];
  const [drivePickerOpen, setDrivePickerOpen] = useState(false);

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Chapter sidebar */}
      <div className="lg:w-64 flex-shrink-0">
        <div className="card sticky top-4">
          <div className="card-header">
            <h3 className="font-semibold text-sm">章立て</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              ひな形: {templateLabel}
            </p>
          </div>
          <div className="card-body p-0">
            {/* Mobile: horizontal scroll pills */}
            <div className="lg:hidden flex gap-1.5 p-3 overflow-x-auto">
              {chapters.map((ch, idx) => {
                const hasContent = ch.photos.length > 0 || ch.description.trim();
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setActiveChapterIdx(idx)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                      idx === activeChapterIdx
                        ? 'bg-murata-primary text-white'
                        : hasContent
                          ? 'bg-murata-primary/10 text-murata-primary'
                          : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {ch.title}
                    {ch.photos.length > 0 && (
                      <span className="ml-1 text-xs opacity-70">
                        ({ch.photos.length})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Desktop: vertical list */}
            <div className="hidden lg:block divide-y divide-gray-50">
              {chapters.map((ch, idx) => {
                const hasContent = ch.photos.length > 0 || ch.description.trim();
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setActiveChapterIdx(idx)}
                    className={`w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors ${
                      idx === activeChapterIdx
                        ? 'bg-murata-primary/5 text-murata-primary font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded flex items-center justify-center text-xs flex-shrink-0 ${
                        hasContent
                          ? 'bg-murata-primary text-white'
                          : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {hasContent ? (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        idx + 1
                      )}
                    </span>
                    <span className="truncate">{ch.title}</span>
                    {ch.photos.length > 0 && (
                      <span className="ml-auto text-xs text-gray-400">
                        {ch.photos.length}枚
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-gray-100">
              <button
                type="button"
                onClick={onAddChapter}
                className="text-sm text-murata-primary font-medium hover:underline"
              >
                + 章を追加
              </button>
              <button
                type="button"
                onClick={onResetChapters}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                ひな形に戻す
              </button>
            </div>
            <p className="px-4 pb-3 text-xs text-gray-400">
              写真も説明文もない章は報告書に出力されません（「工事日数・特記事項」と「会社案内」は常に出力）。写真は1項目3枚ずつ、1ページに2項目並びます。
            </p>
          </div>
        </div>
      </div>

      {/* Chapter editor */}
      <div className="flex-1 min-w-0">
        {activeChapter && (
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onMoveChapter(activeChapterIdx, -1)}
                  disabled={activeChapterIdx === 0}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="上へ移動"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => onMoveChapter(activeChapterIdx, 1)}
                  disabled={activeChapterIdx === chapters.length - 1}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="下へ移動"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveChapter(activeChapterIdx)}
                  disabled={chapters.length <= 1}
                  className="ml-1 px-2 py-1 rounded text-xs text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="この章を削除"
                >
                  章を削除
                </button>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setActiveChapterIdx(Math.max(0, activeChapterIdx - 1))
                  }
                  disabled={activeChapterIdx === 0}
                  className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-30 px-2 py-1"
                >
                  前の章
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setActiveChapterIdx(
                      Math.min(chapters.length - 1, activeChapterIdx + 1)
                    )
                  }
                  disabled={activeChapterIdx === chapters.length - 1}
                  className="text-xs text-murata-primary hover:underline disabled:opacity-30 px-2 py-1"
                >
                  次の章
                </button>
              </div>
            </div>
            <div className="card-body">
              <ChapterEditor
                chapter={activeChapter}
                onUpdate={onUpdateChapter}
                onAddPhoto={onAddPhoto}
                onRemovePhoto={onRemovePhoto}
                onUpdatePhotoCaption={onUpdatePhotoCaption}
                onUpdatePhotoTag={onUpdatePhotoTag}
                onOpenDrivePicker={projectId ? () => setDrivePickerOpen(true) : undefined}
                isCompletionReport={isCompletionReport}
              />
              {drivePickerOpen && (
                <DrivePhotoPicker
                  projectId={projectId}
                  chapterTitle={activeChapter.title}
                  onClose={() => setDrivePickerOpen(false)}
                  onImported={(photos) => onAddImportedPhotos(activeChapter.id, photos)}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Step 4: AI生成 ─────────────────────────────
function Step4Generation({
  chapters,
  generatingChapter,
  generationProgress,
  generationDone,
  generating,
}: {
  chapters: ReportChapter[];
  generatingChapter: string;
  generationProgress: number;
  generationDone: boolean;
  generating: boolean;
}) {
  return (
    <div className="space-y-5">
      {/* Progress */}
      <div className="card">
        <div className="card-body text-center py-8">
          {!generationDone ? (
            <>
              <div className="w-16 h-16 mx-auto mb-4 relative">
                <svg className="animate-spin w-16 h-16" viewBox="0 0 48 48">
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="4"
                  />
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    fill="none"
                    stroke="#1B4F72"
                    strokeWidth="4"
                    strokeDasharray={`${generationProgress * 1.256} 125.6`}
                    strokeLinecap="round"
                    transform="rotate(-90 24 24)"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-murata-primary">
                  {generationProgress}%
                </span>
              </div>
              <p className="text-sm font-medium text-gray-700">
                AI生成中...
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {generatingChapter}
              </p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-bold text-gray-900">
                AI生成が完了しました
              </p>
              <p className="text-xs text-gray-500 mt-1">
                内容を確認して保存してください
              </p>
            </>
          )}
        </div>
      </div>

      {/* Generated chapter summary */}
      {generationDone && (
        <div className="space-y-3">
          {chapters.map((ch) => {
            if (!ch.description && ch.photos.length === 0) return null;
            return (
              <div key={ch.id} className="card">
                <div className="card-header flex items-center gap-2">
                  <span className="w-5 h-5 rounded bg-murata-primary text-white flex items-center justify-center text-xs">
                    {ch.sort_order + 1}
                  </span>
                  <h4 className="font-semibold text-sm">{ch.title}</h4>
                  {ch.ai_generated && (
                    <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                      AI
                    </span>
                  )}
                  <span className="text-xs text-gray-400 ml-auto">
                    {ch.photos.length}枚
                  </span>
                </div>
                <div className="card-body">
                  {/* Photo thumbnails */}
                  {ch.photos.length > 0 && (
                    <div className="flex gap-1 mb-3 overflow-x-auto">
                      {ch.photos.slice(0, 6).map((p) => (
                        <div
                          key={p.id}
                          className="w-12 h-12 rounded overflow-hidden flex-shrink-0 bg-gray-100"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p.preview || p.url || ''}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                      {ch.photos.length > 6 && (
                        <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center text-xs text-gray-400 flex-shrink-0">
                          +{ch.photos.length - 6}
                        </div>
                      )}
                    </div>
                  )}
                  {ch.description && (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-4">
                      {ch.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
