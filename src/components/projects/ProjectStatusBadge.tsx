import type { ProjectStatus } from '@/types';
import { STATUS_COLORS } from '@/lib/constants';

export default function ProjectStatusBadge({
  status,
}: {
  status: ProjectStatus;
}) {
  const colors = STATUS_COLORS[status] || { bg: 'bg-gray-100', text: 'text-gray-600' };
  return (
    <span className={`badge ${colors.bg} ${colors.text}`}>{status}</span>
  );
}
