'use client';

import { useEffect, useState } from 'react';
import type { User } from '@/types';
import type { Permission } from '@/lib/permissions';

export type Me = User & { effective_permissions: Permission[] };

let cache: Promise<Me | null> | null = null;

function load(): Promise<Me | null> {
  if (!cache) {
    cache = fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j?.data as Me) ?? null)
      .catch(() => null);
  }
  return cache;
}

/** ログイン中のユーザー（権限つき）。画面の表示切り替え用 */
export function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    load().then((m) => {
      if (alive) {
        setMe(m);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const refresh = async () => {
    cache = null;
    const m = await load();
    setMe(m);
    return m;
  };

  const can = (p: Permission) => Boolean(me?.effective_permissions?.includes(p));
  return { me, loading, can, refresh };
}
