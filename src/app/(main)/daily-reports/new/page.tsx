'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import WeatherSelector from '@/components/daily-reports/WeatherSelector';
import PhotoCaptureSection from '@/components/daily-reports/PhotoCaptureSection';
import VoiceRecorder from '@/components/VoiceRecorder';
import { compressPhoto, dataURLtoBlob } from '@/lib/compress-photo';
import type { Project, Weather, PhotoEntry, PhotoCategory } from '@/types';

export default function NewDailyReportPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-murata-primary border-t-transparent rounded-full" /></div>}>
      <NewDailyReportContent />
    </Suspense>
  );
}

function NewDailyReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedProjectId = searchParams.get('projectId');

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    project_id: preselectedProjectId || '',
    report_date: new Date().toISOString().slice(0, 10),
    weather: '晴' as Weather,
    workers_count: 1,
    work_content: '',
    safety_notes: '',
  });

  const [photos, setPhotos] = useState<PhotoEntry[]>([]);

  // Fetch projects for selector
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await fetch('/api/projects?status=施工中');
        const { data } = await res.json();
        setProjects(data || []);
        // If preselected project isn't in active list, fetch all
        if (preselectedProjectId && !(data || []).find((p: Project) => p.id === preselectedProjectId)) {
          const allRes = await fetch('/api/projects');
          const { data: allData } = await allRes.json();
          setProjects(allData || []);
        }
      } catch (err) {
        console.error('Failed to fetch projects:', err);
      }
    };
    fetchProjects();
  }, [preselectedProjectId]);

  const updateField = (field: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // Photo handlers
  const handlePhotoAdd = useCallback((file: File) => {
    const id = `photo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const preview = URL.createObjectURL(file);
    const entry: PhotoEntry = {
      id,
      file,
      preview,
      category: '状況' as PhotoCategory,
      caption: '',
    };
    setPhotos((prev) => [...prev, entry]);
  }, []);

  const handlePhotoRemove = useCallback((id: string) => {
    setPhotos((prev) => {
      const photo = prev.find((p) => p.id === id);
      if (photo) URL.revokeObjectURL(photo.preview);
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  const handlePhotoCategory = useCallback((id: string, category: PhotoCategory) => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, category } : p))
    );
  }, []);

  const handlePhotoCaption = useCallback((id: string, caption: string) => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, caption } : p))
    );
  }, []);

  // Upload a single photo
  const uploadPhoto = async (photo: PhotoEntry): Promise<{ url: string; path: string } | null> => {
    try {
      // Compress
      const dataUrl = await compressPhoto(photo.file);
      const blob = dataURLtoBlob(dataUrl);
      const compressedFile = new File([blob], photo.file.name, {
        type: 'image/jpeg',
      });

      const formData = new FormData();
      formData.append('file', compressedFile);
      formData.append('projectId', form.project_id);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');

      const { url, path } = await res.json();
      return { url, path };
    } catch (err) {
      console.error('Photo upload error:', err);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.project_id) {
      setError('案件を選択してください');
      return;
    }
    if (!form.work_content.trim()) {
      setError('作業内容を入力してください');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Upload photos first
      const uploadedPhotos: {
        file_url: string;
        file_path: string;
        category: PhotoCategory;
        caption: string;
        sort_order: number;
      }[] = [];

      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        setPhotos((prev) =>
          prev.map((p) => (p.id === photo.id ? { ...p, uploading: true } : p))
        );

        const result = await uploadPhoto(photo);
        if (result) {
          uploadedPhotos.push({
            file_url: result.url,
            file_path: result.path,
            category: photo.category,
            caption: photo.caption,
            sort_order: i,
          });
        }

        setPhotos((prev) =>
          prev.map((p) =>
            p.id === photo.id
              ? { ...p, uploading: false, uploaded_url: result?.url, uploaded_path: result?.path }
              : p
          )
        );
      }

      // Create daily report
      const res = await fetch('/api/daily-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          photos: uploadedPhotos,
        }),
      });

      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || '登録に失敗しました');
      }

      const { data } = await res.json();
      router.push(`/daily-reports/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '登録に失敗しました');
      setLoading(false);
    }
  };

  const selectedProject = projects.find((p) => p.id === form.project_id);

  return (
    <div className="max-w-2xl mx-auto pb-24">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-500 mb-4">
        <Link href="/dashboard" className="hover:text-murata-primary">
          ダッシュボード
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">日報入力</span>
      </div>

      <h2 className="text-lg font-bold text-gray-900 mb-5">日報入力</h2>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 案件選択 */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-sm">案件選択</h3>
          </div>
          <div className="card-body">
            <select
              value={form.project_id}
              onChange={(e) => updateField('project_id', e.target.value)}
              className="form-select"
              required
            >
              <option value="">案件を選択してください</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.customer_name} - {project.site_name}
                </option>
              ))}
            </select>
            {selectedProject && (
              <p className="text-xs text-gray-500 mt-2 font-mono">
                {selectedProject.project_id}
              </p>
            )}
          </div>
        </div>

        {/* 日付・天気・人数 */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-sm">基本情報</h3>
          </div>
          <div className="card-body space-y-4">
            {/* 日付 */}
            <div>
              <label htmlFor="report_date" className="form-label">
                日付 <span className="text-red-500">*</span>
              </label>
              <input
                id="report_date"
                type="date"
                value={form.report_date}
                onChange={(e) => updateField('report_date', e.target.value)}
                className="form-input"
                required
              />
            </div>

            {/* 天気 */}
            <div>
              <label className="form-label">
                天気 <span className="text-red-500">*</span>
              </label>
              <WeatherSelector
                value={form.weather}
                onChange={(w) => updateField('weather', w)}
              />
            </div>

            {/* 作業人数 */}
            <div>
              <label htmlFor="workers_count" className="form-label">
                作業人数 <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    updateField('workers_count', Math.max(1, form.workers_count - 1))
                  }
                  className="w-12 h-12 flex items-center justify-center rounded-xl border-2 border-gray-200 text-gray-600 text-xl font-bold hover:border-murata-primary hover:text-murata-primary transition-colors"
                >
                  −
                </button>
                <span className="text-2xl font-bold text-gray-900 w-12 text-center">
                  {form.workers_count}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    updateField('workers_count', form.workers_count + 1)
                  }
                  className="w-12 h-12 flex items-center justify-center rounded-xl border-2 border-gray-200 text-gray-600 text-xl font-bold hover:border-murata-primary hover:text-murata-primary transition-colors"
                >
                  +
                </button>
                <span className="text-sm text-gray-500">名</span>
              </div>
            </div>
          </div>
        </div>

        {/* 作業内容 (音声入力) */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-sm">作業内容</h3>
          </div>
          <div className="card-body">
            <VoiceRecorder
              value={form.work_content}
              onChange={(text) => updateField('work_content', text)}
            />
          </div>
        </div>

        {/* 写真 */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-sm">写真</h3>
          </div>
          <div className="card-body">
            <PhotoCaptureSection
              photos={photos}
              onAdd={handlePhotoAdd}
              onRemove={handlePhotoRemove}
              onUpdateCategory={handlePhotoCategory}
              onUpdateCaption={handlePhotoCaption}
            />
          </div>
        </div>

        {/* 安全事項 */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-sm">安全事項・特記事項</h3>
          </div>
          <div className="card-body">
            <textarea
              value={form.safety_notes}
              onChange={(e) => updateField('safety_notes', e.target.value)}
              placeholder="ヒヤリハット、安全確認事項など..."
              rows={3}
              className="form-textarea"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="btn btn-secondary"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? '保存中...' : '日報を保存'}
          </button>
        </div>
      </form>

      {/* Floating camera FAB (mobile) */}
      <button
        type="button"
        onClick={() => {
          const cameraInput = document.createElement('input');
          cameraInput.type = 'file';
          cameraInput.accept = 'image/*';
          cameraInput.capture = 'environment';
          cameraInput.onchange = (e) => {
            const files = (e.target as HTMLInputElement).files;
            if (files) {
              Array.from(files).forEach((file) => {
                if (file.type.startsWith('image/')) {
                  handlePhotoAdd(file);
                }
              });
            }
          };
          cameraInput.click();
        }}
        className="fixed bottom-20 right-4 w-14 h-14 bg-murata-accent text-white rounded-full shadow-lg flex items-center justify-center hover:opacity-90 transition-opacity active:scale-95 z-50 sm:bottom-6"
        aria-label="カメラで撮影"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </button>
    </div>
  );
}
