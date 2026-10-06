'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { previewSiteFolderName } from '@/lib/project-id';
import {
  CONSTRUCTION_TYPES,
  BUILDING_TYPES,
  AUDIENCE_TYPES,
} from '@/lib/constants';

export default function NewProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    customer_name: '',
    site_name: '',
    construction_type: '雨漏り調査' as string,
    building_type: '住宅' as string,
    address: '',
    start_date: '',
    audience_type: '一般施主向け' as string,
  });

  const previewFolderName = useMemo(
    () =>
      previewSiteFolderName({
        customerName: form.customer_name,
        siteName: form.site_name,
        constructionType: form.construction_type,
        startDate: form.start_date,
      }),
    [form.customer_name, form.site_name, form.construction_type, form.start_date]
  );

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || '登録に失敗しました');
      }

      const { data } = await res.json();
      router.push(`/projects/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '登録に失敗しました');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-lg font-bold text-gray-900 mb-5">案件登録</h2>

      {/* 現場フォルダ名 プレビュー */}
      <div className="card mb-5">
        <div className="px-5 py-3 bg-murata-primary-light">
          <p className="text-xs font-medium text-murata-primary mb-1">
            現場フォルダ名（自動生成・連番XXXは登録時に確定）
          </p>
          <p className="font-mono text-sm text-murata-primary font-bold break-all">
            {previewFolderName}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="card-body space-y-5">
            {/* 顧客名 */}
            <div>
              <label htmlFor="customer_name" className="form-label">
                顧客名 <span className="text-red-500">*</span>
              </label>
              <input
                id="customer_name"
                type="text"
                required
                value={form.customer_name}
                onChange={(e) => updateField('customer_name', e.target.value)}
                className="form-input"
                placeholder="例：UDトラックス株式会社"
              />
            </div>

            {/* 現場名 */}
            <div>
              <label htmlFor="site_name" className="form-label">
                現場名 <span className="text-red-500">*</span>
              </label>
              <input
                id="site_name"
                type="text"
                required
                value={form.site_name}
                onChange={(e) => updateField('site_name', e.target.value)}
                className="form-input"
                placeholder="例：水戸工場"
              />
            </div>

            {/* 工事種別 */}
            <div>
              <label htmlFor="construction_type" className="form-label">
                工事種別 <span className="text-red-500">*</span>
              </label>
              <select
                id="construction_type"
                value={form.construction_type}
                onChange={(e) =>
                  updateField('construction_type', e.target.value)
                }
                className="form-select"
              >
                {CONSTRUCTION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* 建物種別 */}
            <div>
              <label htmlFor="building_type" className="form-label">
                建物種別 <span className="text-red-500">*</span>
              </label>
              <select
                id="building_type"
                value={form.building_type}
                onChange={(e) => updateField('building_type', e.target.value)}
                className="form-select"
              >
                {BUILDING_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* 住所 */}
            <div>
              <label htmlFor="address" className="form-label">
                住所
              </label>
              <input
                id="address"
                type="text"
                value={form.address}
                onChange={(e) => updateField('address', e.target.value)}
                className="form-input"
                placeholder="例：茨城県水戸市..."
              />
            </div>

            {/* 着工予定年月 */}
            <div>
              <label htmlFor="start_date" className="form-label">
                着工予定年月
              </label>
              <input
                id="start_date"
                type="month"
                value={form.start_date}
                onChange={(e) => updateField('start_date', e.target.value)}
                className="form-input"
              />
            </div>

            {/* 読み手 */}
            <div>
              <label htmlFor="audience_type" className="form-label">
                読み手（報告書の対象）
              </label>
              <select
                id="audience_type"
                value={form.audience_type}
                onChange={(e) => updateField('audience_type', e.target.value)}
                className="form-select"
              >
                {AUDIENCE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                一般施主向け：わかりやすい表現 ／ 建築関係者向け：専門用語で簡潔に
              </p>
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 mt-5">
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
            {loading ? '登録中...' : '登録する'}
          </button>
        </div>
      </form>
    </div>
  );
}
