'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CATEGORY_COLORS } from '@/lib/constants';
import type { DailyReport, PhotoCategory } from '@/types';

export default function DailyReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const res = await fetch(`/api/daily-reports/${params.id}`);
        if (!res.ok) throw new Error('Not found');
        const { data } = await res.json();
        setReport(data);
      } catch (err) {
        console.error('Failed to fetch report:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-murata-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">日報が見つかりません</p>
        <Link href="/dashboard" className="btn btn-primary mt-4">
          ダッシュボードに戻る
        </Link>
      </div>
    );
  }

  const weatherEmoji =
    report.weather === '晴'
      ? '☀️'
      : report.weather === '曇'
        ? '☁️'
        : report.weather === '雨'
          ? '🌧️'
          : '❄️';

  const reportDate = new Date(report.report_date).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });

  return (
    <div className="max-w-2xl mx-auto">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-500 mb-4">
        {report.project ? (
          <>
            <Link href="/projects" className="hover:text-murata-primary">
              案件一覧
            </Link>
            <span className="mx-2">/</span>
            <Link
              href={`/projects/${report.project.id}`}
              className="hover:text-murata-primary"
            >
              {report.project.customer_name}
            </Link>
          </>
        ) : (
          <Link href="/dashboard" className="hover:text-murata-primary">
            ダッシュボード
          </Link>
        )}
        <span className="mx-2">/</span>
        <span className="text-gray-900">日報</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{reportDate}</h2>
          {report.project && (
            <p className="text-sm text-gray-500 mt-0.5">
              {report.project.customer_name} - {report.project.site_name}
            </p>
          )}
        </div>
        <button
          onClick={() => router.back()}
          className="btn btn-secondary btn-sm"
        >
          戻る
        </button>
      </div>

      <div className="space-y-5">
        {/* 基本情報 */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-sm">基本情報</h3>
          </div>
          <div className="card-body space-y-3">
            <InfoRow label="日付" value={reportDate} />
            <InfoRow
              label="天気"
              value={`${weatherEmoji} ${report.weather}`}
            />
            <InfoRow label="作業人数" value={`${report.workers_count} 名`} />
          </div>
        </div>

        {/* 作業内容 */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-sm">作業内容</h3>
          </div>
          <div className="card-body">
            <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
              {report.work_content}
            </p>
          </div>
        </div>

        {/* 安全事項 */}
        {report.safety_notes && (
          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold text-sm">安全事項・特記事項</h3>
            </div>
            <div className="card-body">
              <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
                {report.safety_notes}
              </p>
            </div>
          </div>
        )}

        {/* 写真 */}
        {report.photos && report.photos.length > 0 && (
          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold text-sm">
                写真（{report.photos.length}枚）
              </h3>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-2 gap-3">
                {report.photos.map((photo) => {
                  const catColors =
                    CATEGORY_COLORS[photo.category as PhotoCategory] || {
                      bg: 'bg-gray-100',
                      text: 'text-gray-600',
                    };
                  return (
                    <div key={photo.id} className="space-y-1.5">
                      <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.file_url}
                          alt={photo.caption || '現場写真'}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`badge text-[10px] ${catColors.bg} ${catColors.text}`}
                        >
                          {photo.category}
                        </span>
                        {photo.caption && (
                          <span className="text-xs text-gray-500 truncate">
                            {photo.caption}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* メタ情報 */}
        <div className="card">
          <div className="card-body space-y-2">
            <InfoRow
              label="登録日時"
              value={new Date(report.created_at).toLocaleString('ja-JP')}
            />
            <InfoRow
              label="最終更新"
              value={new Date(report.updated_at).toLocaleString('ja-JP')}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 font-medium">{value}</span>
    </div>
  );
}
