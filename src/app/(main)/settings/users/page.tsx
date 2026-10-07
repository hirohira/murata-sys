'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { User, UserRole } from '@/types';
import { PERMISSIONS, ROLES, ROLE_DEFAULTS, ROLE_LABEL, effectivePermissions, type Permission } from '@/lib/permissions';

type Row = User & { last_sign_in_at: string | null };
type Actor = { id: string; role: UserRole; permissions: Permission[] };

const ROLE_BADGE: Record<UserRole, string> = {
  admin: 'bg-red-100 text-red-800',
  manager: 'bg-blue-100 text-blue-800',
  worker: 'bg-gray-100 text-gray-700',
};

export default function UsersPage() {
  const [users, setUsers] = useState<Row[]>([]);
  const [actor, setActor] = useState<Actor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<Row | 'new' | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/users');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'ユーザー一覧を取得できませんでした');
      setUsers(json.data);
      setActor(json.me);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ユーザー一覧を取得できませんでした');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = users.filter((u) => showInactive || u.is_active !== false);
  const inactiveCount = users.filter((u) => u.is_active === false).length;

  return (
    <div className="max-w-4xl mx-auto pb-24">
      <div className="text-sm text-gray-500 mb-4">
        <Link href="/settings" className="hover:text-murata-primary">設定</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">ユーザー管理</span>
      </div>

      <div className="flex items-center justify-between gap-3 mb-5">
        <h2 className="text-lg font-bold text-gray-900">ユーザー管理</h2>
        {actor && (
          <button type="button" onClick={() => setEditing('new')} className="btn btn-primary btn-sm">
            ＋ ユーザーを追加
          </button>
        )}
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>}
      {notice && <div className="bg-emerald-50 text-emerald-800 text-sm px-4 py-3 rounded-lg mb-4">{notice}</div>}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin w-8 h-8 border-2 border-murata-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        actor && (
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h3 className="font-semibold text-sm">ユーザー一覧（{visible.length}人）</h3>
              {inactiveCount > 0 && (
                <label className="flex items-center gap-2 text-xs text-gray-500">
                  <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
                  無効化したユーザーも表示（{inactiveCount}人）
                </label>
              )}
            </div>
            <ul className="divide-y divide-gray-100">
              {visible.map((u) => {
                const perms = effectivePermissions(u);
                const inactive = u.is_active === false;
                return (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => setEditing(u)}
                      className={`w-full text-left px-5 py-3 hover:bg-gray-50 flex flex-col sm:flex-row sm:items-center gap-2 ${inactive ? 'opacity-60' : ''}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-900">{u.name}</span>
                          {u.id === actor.id && <span className="text-xs text-gray-400">（自分）</span>}
                          <span className={`badge ${ROLE_BADGE[u.role]}`}>{ROLE_LABEL[u.role]}</span>
                          {inactive && <span className="badge bg-gray-200 text-gray-600">無効</span>}
                        </div>
                        <p className="text-xs text-gray-500 truncate mt-0.5">{u.email}</p>
                      </div>
                      <div className="flex flex-wrap gap-1 sm:justify-end sm:max-w-[45%]">
                        {PERMISSIONS.filter((p) => perms.includes(p.key)).map((p) => (
                          <span key={p.key} className="text-[11px] px-1.5 py-0.5 rounded bg-murata-primary/10 text-murata-primary">
                            {p.label}
                          </span>
                        ))}
                      </div>
                      <div className="text-[11px] text-gray-400 sm:w-28 sm:text-right">
                        {u.last_sign_in_at ? `最終ログイン ${new Date(u.last_sign_in_at).toLocaleDateString('ja-JP')}` : '未ログイン'}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )
      )}

      {editing && actor && (
        <UserForm
          target={editing === 'new' ? null : editing}
          actor={actor}
          onClose={() => setEditing(null)}
          onSaved={async (msg) => {
            setEditing(null);
            setNotice(msg);
            await load();
          }}
        />
      )}
    </div>
  );
}

function UserForm({
  target,
  actor,
  onClose,
  onSaved,
}: {
  target: Row | null;
  actor: Actor;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const isNew = !target;
  const isSelf = target?.id === actor.id;
  const actorIsAdmin = actor.role === 'admin';
  const lockedAdmin = !actorIsAdmin && target?.role === 'admin'; // 管理者以外は管理者を編集できない

  const [name, setName] = useState(target?.name ?? '');
  const [email, setEmail] = useState(target?.email ?? '');
  const [phone, setPhone] = useState(target?.phone ?? '');
  const [role, setRole] = useState<UserRole>(target?.role ?? 'worker');
  const [granted, setGranted] = useState<Permission[]>(
    (target?.permissions ?? []).filter((p): p is Permission => PERMISSIONS.some((d) => d.key === p))
  );
  const [active, setActive] = useState(target?.is_active !== false);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const accessLocked = isSelf || lockedAdmin;
  const roleDefaults = ROLE_DEFAULTS[role];

  const togglePermission = (p: Permission) =>
    setGranted((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError('名前を入力してください');
    if (isNew && password.length < 8) return setError('仮パスワードは8文字以上にしてください');
    if (!isNew && password && password.length < 8) return setError('パスワードは8文字以上にしてください');
    if (!isNew && !active && target?.is_active !== false && !confirm(`${target!.name}さんを無効化します。ログインできなくなりますが、作成した日報・報告書は残ります。よろしいですか？`)) {
      return;
    }

    setSaving(true);
    try {
      // 役割に含まれる権限は保存しない（役割を変えたときに外れるように）
      const permissions = granted.filter((p) => !roleDefaults.includes(p));
      const body: Record<string, unknown> = { name, email, phone };
      if (!accessLocked) Object.assign(body, { role, permissions, is_active: active });
      if (password) body.password = password;

      const res = await fetch(isNew ? '/api/users' : `/api/users/${target!.id}`, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '保存に失敗しました');
      onSaved(
        isNew
          ? `${name}さんを登録しました。メールアドレスと仮パスワードを本人に伝えてください。`
          : `${name}さんの情報を更新しました。`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" role="dialog" aria-modal="true">
      <form onSubmit={submit} className="bg-white w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h3 className="font-bold text-gray-900">{isNew ? 'ユーザーを追加' : `${target!.name}さんの編集`}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="閉じる">
            ×
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {lockedAdmin && (
            <p className="text-xs bg-amber-50 text-amber-800 px-3 py-2 rounded">管理者の情報は管理者のみ変更できます。</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="u-name" className="form-label">名前 <span className="text-red-500">*</span></label>
              <input id="u-name" className="form-input" value={name} onChange={(e) => setName(e.target.value)} disabled={lockedAdmin} placeholder="例：村田 茂" />
            </div>
            <div>
              <label htmlFor="u-phone" className="form-label">電話番号</label>
              <input id="u-phone" className="form-input" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={lockedAdmin} />
            </div>
          </div>

          <div>
            <label htmlFor="u-email" className="form-label">メールアドレス（ログインID） <span className="text-red-500">*</span></label>
            <input id="u-email" type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} disabled={lockedAdmin} autoComplete="off" />
          </div>

          <div>
            <label htmlFor="u-password" className="form-label">
              {isNew ? <>仮パスワード（8文字以上） <span className="text-red-500">*</span></> : 'パスワードを再設定（変更する場合のみ）'}
            </label>
            <input id="u-password" type="text" className="form-input font-mono" value={password} onChange={(e) => setPassword(e.target.value)} disabled={lockedAdmin} autoComplete="new-password" placeholder={isNew ? '本人に伝えるパスワード' : '空欄なら変更しない'} />
            <p className="text-xs text-gray-400 mt-1">本人はログイン後、設定画面からパスワードを変更できます。</p>
          </div>

          {/* 役割 */}
          <fieldset disabled={accessLocked}>
            <legend className="form-label">役割</legend>
            <div className="grid grid-cols-3 gap-2">
              {ROLES.map((r) => {
                const disabled = r.key === 'admin' && !actorIsAdmin;
                return (
                  <label
                    key={r.key}
                    className={`border-2 rounded-lg px-3 py-2 text-center text-sm cursor-pointer ${
                      role === r.key ? 'border-murata-primary bg-murata-primary/5 text-murata-primary font-medium' : 'border-gray-200 text-gray-600'
                    } ${disabled || accessLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title={disabled ? '管理者の登録は管理者のみ行えます' : r.description}
                  >
                    <input type="radio" name="role" className="sr-only" value={r.key} checked={role === r.key} disabled={disabled} onChange={() => setRole(r.key)} />
                    {r.label}
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 mt-1">{ROLES.find((r) => r.key === role)?.description}</p>
          </fieldset>

          {/* 個別の権限 */}
          <fieldset disabled={accessLocked}>
            <legend className="form-label">権限</legend>
            <div className="space-y-2">
              {PERMISSIONS.map((p) => {
                const fromRole = roleDefaults.includes(p.key);
                const cannotGrant = !actorIsAdmin && !actor.permissions.includes(p.key);
                const checked = fromRole || granted.includes(p.key);
                return (
                  <label key={p.key} className={`flex items-start gap-2 text-sm ${fromRole || cannotGrant || accessLocked ? 'opacity-60' : 'cursor-pointer'}`}>
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={checked}
                      disabled={fromRole || cannotGrant}
                      onChange={() => togglePermission(p.key)}
                    />
                    <span>
                      <span className="font-medium text-gray-900">{p.label}</span>
                      {fromRole && <span className="text-xs text-gray-400">（{ROLE_LABEL[role]}に含まれる）</span>}
                      <span className="block text-xs text-gray-500">{p.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* 有効・無効 */}
          {!isNew && (
            <label className={`flex items-center gap-2 text-sm ${accessLocked ? 'opacity-60' : 'cursor-pointer'}`}>
              <input type="checkbox" checked={active} disabled={accessLocked} onChange={(e) => setActive(e.target.checked)} />
              <span>
                <span className="font-medium text-gray-900">ログインを許可する</span>
                <span className="block text-xs text-gray-500">外すと無効化され、ログインできなくなります。作成した日報・報告書は残り、あとで元に戻せます。</span>
              </span>
            </label>
          )}

          {isSelf && (
            <p className="text-xs text-gray-500">自分の役割・権限・有効状態は変更できません（ほかの管理者に依頼してください）。</p>
          )}

          {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded">{error}</div>}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2 sticky bottom-0 bg-white">
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">キャンセル</button>
          <button type="submit" disabled={saving || lockedAdmin} className="btn btn-primary btn-sm">
            {saving ? '保存中...' : isNew ? '登録する' : '保存する'}
          </button>
        </div>
      </form>
    </div>
  );
}
