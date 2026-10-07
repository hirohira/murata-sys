'use client';

import { Suspense } from 'react';
import ReportWizard from '@/components/reports/ReportWizard';

export default function NewReportPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-murata-primary border-t-transparent rounded-full" />
        </div>
      }
    >
      <ReportWizard />
    </Suspense>
  );
}
