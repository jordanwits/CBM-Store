'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import MobileMenu from './MobileMenu';
import { createClient } from '@/lib/supabase/client';

type UserControlsProps = {
  isDevMode: boolean;
};

type ProfileRow = {
  role: string | null;
  active: boolean | null;
};

export default function UserControls({ isDevMode }: UserControlsProps) {
  const supabase = useMemo(() => createClient(), []);

  const [loaded, setLoaded] = useState(false);
  const [email, setEmail] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (isDevMode) {
        if (cancelled) return;
        setEmail('demo@cbmplastics.com');
        setIsAdmin(true);
        setLoaded(true);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled) return;
      setEmail(user?.email || '');

      if (!user) {
        // Should be rare because middleware protects app routes, but keep UI safe.
        setIsAdmin(false);
        setLoaded(true);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, active')
        .eq('id', user.id)
        .single();

      if (cancelled) return;
      const p = profile as ProfileRow | null;
      setIsAdmin(p?.role === 'admin' && p?.active !== false);
      setLoaded(true);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [isDevMode, supabase]);

  const userEmail = isDevMode ? 'demo@cbmplastics.com' : email;

  return (
    <>
      <div className="hidden sm:flex items-center gap-3 border-l pl-3 ml-3">
        {isDevMode ? (
          <>
            <span className="text-sm text-gray-600 truncate max-w-[150px]">{userEmail}</span>
            <Link
              href="/admin"
              className="text-sm font-medium text-primary hover:underline underline-offset-2"
            >
              Admin
            </Link>
            <Link
              href="/login"
              className="text-sm font-medium text-gray-700 hover:text-gray-900 px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors"
            >
              Login
            </Link>
          </>
        ) : !loaded ? (
          <span className="text-sm text-gray-500 px-3 py-1.5">Loading…</span>
        ) : email ? (
          <>
            <span className="text-sm text-gray-600 truncate max-w-[150px]">{userEmail}</span>
            {isAdmin && (
              <Link
                href="/admin"
                className="text-sm font-medium text-primary hover:underline underline-offset-2"
              >
                Admin
              </Link>
            )}
            <form action="/logout" method="POST">
              <button
                type="submit"
                className="text-sm font-medium text-gray-700 hover:text-gray-900 px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors"
              >
                Logout
              </button>
            </form>
          </>
        ) : (
          <Link
            href="/login"
            className="text-sm font-medium text-gray-700 hover:text-gray-900 px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors"
          >
            Login
          </Link>
        )}
      </div>

      <MobileMenu userEmail={userEmail} isAdmin={isAdmin} isDevMode={isDevMode} />
    </>
  );
}

