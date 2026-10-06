'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Report, ReportType, ReportStatus } from '@/types';
import { REPORT_STATUS_COLORS } from '@/lib/constants';

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<ReportType | ''>('');
  const [filterStatus, setFilterStatus] = useState<ReportStatus | ''>('');

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const params = new URLSearchParams();
        if (filterType) params.set('reportType', filterType);
        if (filterStatus) params.set('status', filterStatus);
        const res = await fetch(`/api/reports?${params}`);
        const { data } = await res.json();
        setReports(data || []);
      } catch (err) {
        console.error('Failed to fetch reports:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, [filterType, filterStatus]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-murata-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900">報告書一覧</h2>
          <p className="text-sm text-gray-500">{reports.length} 件の報告書</p>
        </div>
        <Link href="/reports/new" className="btn btn-primary btn-sm">
          + 新規作成
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={filterType}
          onChange={(e) => {
            setFilterType(e.target.value as ReportType | '');
            setLoading(true);
          }}
          className="form-select text-sm py-1.5 w-auto"
        >
          <option value="">すべての種別</option>
          <option value="調査報告書">調査報告書</option>
          <option value="完了報告書">完了報告書</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value as ReportStatus | '');
            setLoading(true);
          }}
          className="form-select text-sm py-1.5 w-auto"
        >
          <option value="">すべてのステータス</option>
          <option value="下書き">下書き</option>
          <option value="確認中">確認中</option>
          <option value="承認済み">承認済み</option>
        </select>
      </div>

      {/* List */}
      {reports.length === 0 ? (
        <div className="card">
          <div className="p-12 text-center">
            <p className="text-gray-500 mb-4">まだ報告書がありません</p>
            <Link href="/reports/new" className="btn btn-primary">
              最初の報告書を作成する
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <Link
              key={report.id}
              href={`/reports/${report.id}`}
              className="card block hover:shadow-md transition-shadow"
            >
              <div className="card-body">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm">
                        {report.report_type === '調査報告書' ? '🔍' : '✅'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {report.report_type}
                      </span>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          REPORT_STATUS_COLORS[report.status as ReportStatus]?.bg || 'bg-gray-100'
                        } ${
                          REPORT_STATUS_COLORS[report.status as ReportStatus]?.text || 'text-gray-600'
                        }`}
                      >
                        {report.status}
                      </span>
                      {report.generated_by_ai && (
                        <span className="text-xs text-blue-600">🤖 AI生成</span>
                      )}
                    </div>
                    <p className="font-medium text-sm text-gray-900 truncate">
                      {report.title}
                    </p>
                    {report.project && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {report.project.customer_name} - {report.project.site_name}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-xs text-gray-400 whitespace-nowrap">
                    {new Date(report.created_at).toLocaleDateString('ja-JP')}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
