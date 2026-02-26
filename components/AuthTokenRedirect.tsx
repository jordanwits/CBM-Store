'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

/**
 * Catches auth tokens (invite/recovery) that landed on the wrong page.
 * Supabase redirects to /home instead of /update-password when the redirect URL
 * isn't whitelisted. This redirects to /update-password with tokens preserved.
 */
export function AuthTokenRedirect() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname === '/update-password') return;

    const hash = typeof window !== 'undefined' ? window.location.hash?.substring(1) : '';
    const search = typeof window !== 'undefined' ? window.location.search?.substring(1) : '';

    const params = hash ? new URLSearchParams(hash) : (search ? new URLSearchParams(search) : null);
    if (!params) return;

    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const type = params.get('type');

    const isInviteOrRecovery = type === 'invite' || type === 'recovery';
    if (!accessToken || !refreshToken || !isInviteOrRecovery) return;

    // Preserve full hash for update-password page (it expects access_token, refresh_token, type)
    const tokenFragment = window.location.hash || `#${params.toString()}`;
    router.replace(`/update-password${tokenFragment}`);
  }, [pathname, router]);

  return null;
}
