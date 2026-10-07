'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useMe } from '@/lib/use-me';
import { PERMISSIONS, ROLE_LABEL } from '@/lib/permissions';

export default function SettingsPage() {
  const { me, can, refresh } = useMe();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    if (me) {
      setName(me.name);
      setPhone(me.phone || '');
    }
  }, [me]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '保存に失敗しました');
      await refresh();
      setProfileMsg({ ok: true, text: '保存しました' });
    } catch (err) {
      setProfileMsg({ ok: false, text: err instanceof Error ? err.message : '保存に失敗しました' });
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (password.length < 8) return setPwMsg({ ok: false, text: 'パスワードは8文字以上にしてください' });
    if (password !== password2) return setPwMsg({ ok: false, text: '確認用のパスワードが一致しません' });
    setSavingPw(true);
    const { error } = await createClient().auth.updateUser({ password });
    setSavingPw(false);
    if (error) return setPwMsg({ ok: false, text: 'パスワードを変更できませんでした。もう一度お試しください' });
    setPassword('');
    setPassword2('');
    setPwMsg({ ok: true, text: 'パスワードを変更しました' });
  };

  const handleLogout = async () => {
    try {
      await createClient().auth.signOut();
    } finally {
      window.location.href = '/login';
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-lg font-bold text-gray-900 mb-5">設定</h2>

      <div className="space-y-5">
        {/* アカウント */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-sm">アカウント</h3>
          </div>
          <form onSubmit={saveProfile} className="card-body space-y-4">
            {me && (
              <div className="text-sm space-y-1">
                <p>
                  <span className="text-gray-500">メールアドレス：</span>
                  {me.email}
                </p>
                <p>
                  <span className="text-gray-500">役割：</span>
                  {ROLE_LABEL[me.role]}
                </p>
                <p>
                  <span className="text-gray-500">権限：</span>
                  {me.effective_permissions.length
                    ? PERMISSIONS.filter((p) => me.effective_permissions.includes(p.key))
                        .map((p) => p.label)
                        .join('、')
                    : 'なし（日報・報告書の作成）'}
                </p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="me-name" className="form-label">名前</label>
                <input id="me-name" className="form-input" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label htmlFor="me-phone" className="form-label">電話番号</label>
                <input id="me-phone" className="form-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="報告書の担当者TELに使えます" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button type="submit" disabled={savingProfile} className="btn btn-primary btn-sm">
                {savingProfile ? '保存中...' : '保存'}
              </button>
              {profileMsg && (
                <span className={`text-sm ${profileMsg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{profileMsg.text}</span>
              )}
            </div>
          </form>
        </div>

        {/* パスワード変更 */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-sm">パスワード変更</h3>
            <p className="text-xs text-gray-400 mt-0.5">仮パスワードで登録された場合は、最初にここで変更してください。</p>
          </div>
          <form onSubmit={changePassword} className="card-body space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="pw1" className="form-label">新しいパスワード（8文字以上）</label>
                <input id="pw1" type="password" autoComplete="new-password" className="form-input" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div>
                <label htmlFor="pw2" className="form-label">確認のためもう一度</label>
                <input id="pw2" type="password" autoComplete="new-password" className="form-input" value={password2} onChange={(e) => setPassword2(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button type="submit" disabled={savingPw} className="btn btn-primary btn-sm">
                {savingPw ? '変更中...' : 'パスワードを変更'}
              </button>
              {pwMsg && <span className={`text-sm ${pwMsg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{pwMsg.text}</span>}
            </div>
          </form>
        </div>

        {/* ユーザー管理 */}
        {can('manage_users') && (
          <Link href="/settings/users" className="card block hover:shadow-md transition-shadow">
            <div className="card-body flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm text-gray-900">ユーザー管理</p>
                <p className="text-xs text-gray-500 mt-0.5">ユーザーの登録・編集、役割と権限の設定、無効化</p>
              </div>
              <span className="text-murata-primary text-sm">開く →</span>
            </div>
          </Link>
        )}

        {/* システム情報 */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-sm">システム情報</h3>
          </div>
          <div className="card-body space-y-2">
            <InfoRow label="写真の自動圧縮" value="有効（1200px）" />
            <InfoRow label="音声入力" value="有効（Whisper）" />
            <InfoRow label="構成" value="Next.js 14 + Supabase / Vercel" />
          </div>
        </div>

        <button onClick={handleLogout} className="btn btn-secondary w-full">
          ログアウト
        </button>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 font-medium">{value}</span>
    </div>
  );
}
