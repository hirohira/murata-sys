'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import ProjectStatusBadge from '@/components/projects/ProjectStatusBadge';
import type { Project, ProjectStatus } from '@/types';
import { PROJECT_STATUSES } from '@/lib/constants';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (searchQuery) params.set('search', searchQuery);

    try {
      const res = await fetch(`/api/projects?${params}`);
      const { data } = await res.json();
      setProjects(data || []);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900">案件一覧</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {projects.length} 件の案件
          </p>
        </div>
        <Link href="/projects/new" className="btn btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          新規案件
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input
          type="text"
          placeholder="顧客名・現場名で検索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="form-input sm:max-w-xs"
        />
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setStatusFilter('all')}
            className={`btn btn-sm whitespace-nowrap ${
              statusFilter === 'all' ? 'btn-primary' : 'btn-secondary'
            }`}
          >
            すべて
          </button>
          {PROJECT_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`btn btn-sm whitespace-nowrap ${
                statusFilter === s ? 'btn-primary' : 'btn-secondary'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Project list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-murata-primary border-t-transparent rounded-full" />
        </div>
      ) : projects.length === 0 ? (
        <div className="card">
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">📂</div>
            <p className="text-gray-500 mb-4">案件がまだありません</p>
            <Link href="/projects/new" className="btn btn-primary">
              最初の案件を登録する
            </Link>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-5 py-3">
                    顧客名
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-5 py-3">
                    現場名
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-5 py-3 hidden sm:table-cell">
                    工事種別
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-5 py-3 hidden md:table-cell">
                    建物種別
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-5 py-3">
                    状態
                  </th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr
                    key={project.id}
                    className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/projects/${project.id}`}
                        className="font-medium text-gray-900 hover:text-murata-primary"
                      >
                        {project.customer_name}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">
                      {project.site_name}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600 hidden sm:table-cell">
                      {project.construction_type}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600 hidden md:table-cell">
                      {project.building_type}
                    </td>
                    <td className="px-5 py-3.5">
                      <ProjectStatusBadge
                        status={project.status as ProjectStatus}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
