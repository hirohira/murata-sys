'use client';

import { useState } from 'react';

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);

  const handleLogout = async () => {
    try {
      const { createClient } = await import(
        '@/lib/supabase/client'
      );
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.href = '/login';
    } catch {
      window.location.href = '/login';
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-lg font-bold text-gray-900 mb-5">設定</h2>

      <div className="space-y-5">
        {/* Account info */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-sm">アカウント情報</h3>
          </div>
          <div className="card-body space-y-3">
            <p className="text-sm text-gray-500">
              アカウント情報はSupabase管理画面から変更できます。
            </p>
          </div>
        </div>

        {/* App settings */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-sm">アプリ設定</h3>
          </div>
          <div className="card-body space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  写真自動圧縮
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  アップロード前に写真を自動圧縮します（1200px, 60%）
                </p>
              </div>
              <div className="badge bg-emerald-100 text-emerald-800">有効</div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  音声入力（Whisper API）
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  音声を文字起こしして作業内容に入力します
                </p>
              </div>
              <div className="badge bg-emerald-100 text-emerald-800">有効</div>
            </div>
          </div>
        </div>

        {/* System info */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-sm">システム情報</h3>
          </div>
          <div className="card-body space-y-2">
            <InfoRow label="バージョン" value="1.0.0" />
            <InfoRow label="ビルド" value="Next.js 14 + Supabase" />
            <InfoRow label="デプロイ先" value="Vercel" />
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="btn btn-secondary w-full"
        >
          ログアウト
        </button>

        {saved && (
          <div className="bg-emerald-50 text-emerald-700 text-sm px-4 py-3 rounded-lg text-center">
            設定を保存しました
          </div>
        )}
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
