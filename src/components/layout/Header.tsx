'use client';

import { usePathname } from 'next/navigation';

const pageTitles: Record<string, string> = {
  '/dashboard': 'ダッシュボード',
  '/projects': '案件一覧',
  '/projects/new': '案件登録',
  '/daily-reports/new': '日報入力',
  '/settings': '設定',
};

export default function Header() {
  const pathname = usePathname();

  // Find the best matching title
  let title = 'MURATA';
  for (const [path, t] of Object.entries(pageTitles)) {
    if (pathname === path || pathname.startsWith(path + '/')) {
      title = t;
    }
  }

  // Special case for project detail
  if (pathname.match(/^\/projects\/[^/]+$/) && pathname !== '/projects/new') {
    title = '案件詳細';
  }

  return (
    <header className="main-header">
      <h1 className="text-base font-semibold text-gray-900 lg:text-lg">
        {title}
      </h1>
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-500 hidden sm:block">
          株式会社MURATA
        </span>
      </div>
    </header>
  );
}
