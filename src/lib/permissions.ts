// 役割と権限の定義（画面・API共通）
import type { UserRole } from '@/types';

export type Permission = 'manage_users' | 'approve_reports' | 'delete_projects';

export const PERMISSIONS: { key: Permission; label: string; description: string }[] = [
  { key: 'manage_users', label: 'ユーザー登録・編集', description: 'ユーザーの追加、役割・権限の変更、無効化ができる' },
  { key: 'approve_reports', label: '報告書の承認', description: '確認中の報告書を承認・差し戻しできる' },
  { key: 'delete_projects', label: '案件の削除', description: '案件を削除できる' },
];

export const ROLES: { key: UserRole; label: string; description: string }[] = [
  { key: 'admin', label: '管理者', description: 'すべての操作ができる' },
  { key: 'manager', label: '責任者', description: '報告書の承認ができる。ほかの権限は個別に付与' },
  { key: 'worker', label: '作業員', description: '日報・報告書の作成ができる。ほかの権限は個別に付与' },
];

export const ROLE_LABEL: Record<UserRole, string> = { admin: '管理者', manager: '責任者', worker: '作業員' };

/** 役割に最初から含まれる権限 */
export const ROLE_DEFAULTS: Record<UserRole, Permission[]> = {
  admin: ['manage_users', 'approve_reports', 'delete_projects'],
  manager: ['approve_reports'],
  worker: [],
};

/** 役割の権限＋個別に付与された権限 */
export function effectivePermissions(user: { role: UserRole; permissions?: string[] | null }): Permission[] {
  const set = new Set<Permission>(ROLE_DEFAULTS[user.role] ?? []);
  for (const p of user.permissions ?? []) {
    if (PERMISSIONS.some((d) => d.key === p)) set.add(p as Permission);
  }
  return Array.from(set);
}

export function hasPermission(
  user: { role: UserRole; permissions?: string[] | null } | null | undefined,
  permission: Permission
): boolean {
  return Boolean(user) && effectivePermissions(user!).includes(permission);
}
