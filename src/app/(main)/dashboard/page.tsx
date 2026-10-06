'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ProjectStatusBadge from '@/components/projects/ProjectStatusBadge';
import type { Project, DailyReport, Report, ProjectStatus, ReportStatus } from '@/types';
import { REPORT_STATUS_COLORS } from '@/lib/constants';

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [recentReports, setRecentReports] = useState<DailyReport[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [projRes, reportRes, reportsRes] = await Promise.all([
          fetch('/api/projects'),
          fetch('/api/daily-reports'),
          fetch('/api/reports'),
        ]);
        const { data: projData } = await projRes.json();
        const { data: reportData } = await reportRes.json();
        const { data: reportsData } = await reportsRes.json();
        setProjects(projData || []);
        setRecentReports((reportData || []).slice(0, 5));
        setReports(reportsData || []);
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-murata-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const activeProjects = projects.filter(
    (p) => p.status !== '完了'
  );
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayReports = recentReports.filter(
    (r) => r.report_date === todayStr
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-gray-900">ダッシュボード</h2>
        <Link href="/daily-reports/new" className="btn btn-accent">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          日報を書く
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <StatCard label="アクティブ案件" value={activeProjects.length} unit="件" />
        <StatCard label="全案件" value={projects.length} unit="件" />
        <StatCard label="本日の日報" value={todayReports.length} unit="件" />
        <StatCard label="今月の日報" value={recentReports.length} unit="件" />
      </div>

      {/* Report stats */}
      {reports.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          <Link href="/reports" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 hover:shadow-sm transition-shadow">
            <span className="text-sm text-gray-500">報告書</span>
            <span className="text-sm font-bold text-gray-900">{reports.length}件</span>
          </Link>
          {(['下書き', '確認中', '承認済み'] as ReportStatus[]).map((status) => {
            const count = reports.filter((r) => r.status === status).length;
            if (count === 0) return null;
            const color = REPORT_STATUS_COLORS[status];
            return (
              <Link key={status} href={`/reports?status=${status}`} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg ${color.bg} hover:opacity-80 transition-opacity`}>
                <span className={`text-xs font-medium ${color.text}`}>{status}</span>
                <span className={`text-sm font-bold ${color.text}`}>{count}</span>
              </Link>
            );
          })}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Recent reports */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="font-semibold text-sm">最近の日報</h3>
            <Link
              href="/daily-reports/new"
              className="text-xs text-murata-primary hover:underline"
            >
              新規入力 →
            </Link>
          </div>
          <div className="card-body p-0">
            {recentReports.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-500 text-sm mb-3">
                  まだ日報がありません
                </p>
                <Link
                  href="/daily-reports/new"
                  className="btn btn-primary btn-sm"
                >
                  最初の日報を入力する
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {recentReports.map((report) => {
                  const weatherEmoji =
                    report.weather === '晴'
                      ? '☀️'
                      : report.weather === '曇'
                        ? '☁️'
                        : report.weather === '雨'
                          ? '🌧️'
                          : '❄️';
                  return (
                    <Link
                      key={report.id}
                      href={`/daily-reports/${report.id}`}
                      className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {report.project?.customer_name || '案件'} -{' '}
                          {report.project?.site_name || ''}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                          {report.work_content}
                        </p>
                      </div>
                      <div className="text-right text-sm flex-shrink-0 ml-3">
                        <p className="text-xs text-gray-400">
                          {new Date(report.report_date).toLocaleDateString(
                            'ja-JP',
                            { month: 'short', day: 'numeric' }
                          )}
                        </p>
                        <span>{weatherEmoji}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Active projects */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="font-semibold text-sm">アクティブ案件</h3>
            <Link
              href="/projects"
              className="text-xs text-murata-primary hover:underline"
            >
              すべて見る →
            </Link>
          </div>
          <div className="card-body p-0">
            {activeProjects.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-500 text-sm mb-3">
                  アクティブな案件はありません
                </p>
                <Link
                  href="/projects/new"
                  className="btn btn-primary btn-sm"
                >
                  案件を登録する
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {activeProjects.slice(0, 5).map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {project.customer_name}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {project.site_name}
                      </p>
                    </div>
                    <ProjectStatusBadge
                      status={project.status as ProjectStatus}
                    />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  unit,
}: {
  label: string;
  value: number;
  unit: string;
}) {
  return (
    <div className="card">
      <div className="p-4 text-center">
        <p className="text-2xl font-bold text-gray-900">
          {value}
          <span className="text-sm font-normal text-gray-500 ml-0.5">
            {unit}
          </span>
        </p>
        <p className="text-xs text-gray-500 mt-1">{label}</p>
      </div>
    </div>
  );
}
