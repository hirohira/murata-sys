'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError('メールアドレスまたはパスワードが正しくありません');
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  };

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl shadow-lg p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-murata-primary text-white text-2xl font-bold mb-4">
            M
          </div>
          <h1 className="text-xl font-bold text-gray-900">
            MURATA 日報・報告書システム
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            ログインして業務を開始してください
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base
                         focus:ring-2 focus:ring-murata-primary focus:border-transparent
                         outline-none transition-all"
              placeholder="example@murata-sf.co.jp"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              パスワード
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base
                         focus:ring-2 focus:ring-murata-primary focus:border-transparent
                         outline-none transition-all"
              placeholder="パスワードを入力"
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-murata-primary text-white font-medium rounded-lg
                       hover:bg-murata-dark transition-colors disabled:opacity-50
                       disabled:cursor-not-allowed text-base"
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
      </div>

      <p className="text-center text-xs text-gray-400 mt-6">
        株式会社MURATA 業務支援システム
      </p>
    </div>
  );
}
