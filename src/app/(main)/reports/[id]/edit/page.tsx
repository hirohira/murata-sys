'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ReportWizard from '@/components/reports/ReportWizard';
import type { Report } from '@/types';

/** 報告書の編集（作成時と同じ画面で、内容を読み込んだ状態から編集する） */
export default function EditReportPage() {
  const params = useParams();
  const reportId = params.id as string;
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/reports/${reportId}`);
        if (!res.ok) throw new Error();
        const { data } = await res.json();
        setReport(data);
      } catch {
        setError('報告書を読み込めませんでした');
      }
    })();
  }, [reportId]);

  const spinner = (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin w-8 h-8 border-2 border-murata-primary border-t-transparent rounded-full" />
    </div>
  );

  if (error) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
        <Link href={`/reports/${reportId}`} className="btn btn-secondary mt-4">
          報告書に戻る
        </Link>
      </div>
    );
  }

  if (!report) return spinner;

  return (
    <Suspense fallback={spinner}>
      <ReportWizard initialReport={report} />
    </Suspense>
  );
}
