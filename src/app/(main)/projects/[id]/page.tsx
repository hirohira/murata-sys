'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import ProjectStatusBadge from '@/components/projects/ProjectStatusBadge';
import DriveFolderButton from '@/components/projects/DriveFolderButton';
import type { Project, DailyReport, ProjectStatus } from '@/types';

type Tab = 'overview' | 'reports' | 'photos';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [projRes, reportsRes] = await Promise.all([
          fetch(`/api/projects/${params.id}`),
          fetch(`/api/daily-reports?projectId=${params.id}`),
        ]);
        const { data: projData } = await projRes.json();
        const { data: reportsData } = await reportsRes.json();
        setProject(projData);
        setReports(reportsData || []);
      } catch (err) {
        console.error('Failed to fetch project:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-murata-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">案件が見つかりません</p>
        <Link href="/projects" className="btn btn-primary mt-4">
          案件一覧に戻る
        </Link>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: '概要' },
    { key: 'reports', label: `日報 (${reports.length})` },
    { key: 'photos', label: '写真' },
  ];

  return (
    <div>
      {/* Breadcrumb */}
      <div className="text-sm text-gray-500 mb-4">
        <Link href="/projects" className="hover:text-murata-primary">
          案件一覧
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">{project.customer_name}</span>
      </div>

      {/* Project header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-lg font-bold text-gray-900">
              {project.customer_name} - {project.site_name}
            </h2>
            <ProjectStatusBadge status={project.status as ProjectStatus} />
          </div>
          <p className="font-mono text-xs text-gray-500">
            現場ID {project.project_id}
            {project.legacy_project_id && (
              <span className="ml-2 text-gray-400">（旧ID {project.legacy_project_id}）</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <DriveFolderButton
            project={project}
            onCreated={(folder) =>
              setProject((prev) =>
                prev ? { ...prev, drive_folder_id: folder.id, drive_folder_url: folder.url } : prev
              )
            }
          />
          <Link
            href={`/daily-reports/new?projectId=${project.id}`}
            className="btn btn-primary btn-sm"
          >
            日報を書く
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-5">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-murata-primary text-murata-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="grid gap-5 md:grid-cols-2">
          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold text-sm">基本情報</h3>
            </div>
            <div className="card-body space-y-3">
              <InfoRow label="顧客名" value={project.customer_name} />
              <InfoRow label="現場名" value={project.site_name} />
              <InfoRow label="工事種別" value={project.construction_type} />
              <InfoRow label="建物種別" value={project.building_type} />
              <InfoRow label="住所" value={project.address || '未設定'} />
              <InfoRow
                label="着工予定"
                value={project.start_date || '未設定'}
              />
              <InfoRow label="読み手" value={project.audience_type} />
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold text-sm">進捗</h3>
            </div>
            <div className="card-body space-y-3">
              <InfoRow label="日報件数" value={`${reports.length} 件`} />
              <InfoRow
                label="登録日"
                value={new Date(project.created_at).toLocaleDateString('ja-JP')}
              />
              <InfoRow
                label="最終更新"
                value={new Date(project.updated_at).toLocaleDateString('ja-JP')}
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div>
          {reports.length === 0 ? (
            <div className="card">
              <div className="p-12 text-center">
                <p className="text-gray-500 mb-4">
                  まだ日報がありません
                </p>
                <Link
                  href={`/daily-reports/new?projectId=${project.id}`}
                  className="btn btn-primary"
                >
                  最初の日報を入力する
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <Link
                  key={report.id}
                  href={`/daily-reports/${report.id}`}
                  className="card block hover:shadow-md transition-shadow"
                >
                  <div className="card-body">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">
                          {new Date(report.report_date).toLocaleDateString(
                            'ja-JP',
                            {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              weekday: 'short',
                            }
                          )}
                        </p>
                        <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">
                          {report.work_content}
                        </p>
                      </div>
                      <div className="text-right text-sm">
                        <span className="text-lg mr-1">
                          {report.weather === '晴'
                            ? '☀️'
                            : report.weather === '曇'
                              ? '☁️'
                              : report.weather === '雨'
                                ? '🌧️'
                                : '❄️'}
                        </span>
                        <span className="text-gray-500">
                          {report.workers_count}名
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'photos' && (
        <div className="card">
          <div className="p-12 text-center">
            <p className="text-gray-500">写真は日報入力時にアップロードされます</p>
          </div>
        </div>
      )}
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
