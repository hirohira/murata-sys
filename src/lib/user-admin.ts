// サーバー専用：ユーザー管理の入力チェックと、権限の付け過ぎを防ぐルール
import { PERMISSIONS, effectivePermissions, type Permission } from '@/lib/permissions';
import type { CurrentUser } from '@/lib/current-user';
import type { UserRole } from '@/types';

const ROLE_KEYS: UserRole[] = ['admin', 'manager', 'worker'];

export function parseRole(v: unknown): UserRole | null {
  return ROLE_KEYS.includes(v as UserRole) ? (v as UserRole) : null;
}

export function parsePermissions(v: unknown): Permission[] {
  if (!Array.isArray(v)) return [];
  return v.filter((p): p is Permission => PERMISSIONS.some((d) => d.key === p));
}

export function validatePassword(pw: unknown): string | null {
  if (typeof pw !== 'string' || pw.length < 8) return 'パスワードは8文字以上にしてください';
  return null;
}

/**
 * 操作する人（actor）が、対象の役割・権限を設定してよいか。
 * ・管理者以外は「管理者」を作成・変更できない
 * ・自分が持っていない権限は他人に付与できない
 */
export function checkGrant(
  actor: CurrentUser,
  opts: { targetCurrentRole?: UserRole; role: UserRole; permissions: Permission[] }
): string | null {
  const actorIsAdmin = actor.profile.role === 'admin';
  if (!actorIsAdmin) {
    if (opts.role === 'admin' || opts.targetCurrentRole === 'admin') {
      return '管理者の登録・変更は管理者のみ行えます';
    }
    // 役割に含まれる権限も含めて、自分が持っていない権限を与えようとしていないか
    const target = effectivePermissions({ role: opts.role, permissions: opts.permissions });
    const missing = target.filter((p) => !actor.permissions.includes(p));
    if (missing.length > 0) return '自分が持っていない権限は付与できません';
  }
  return null;
}
