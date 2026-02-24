'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from 'core/components/Button';
import { createClient } from '@/lib/supabase/client';

export default function MarketingHeaderActions() {
  const supabase = useMemo(() => createClient(), []);
  const [loaded, setLoaded] = useState(false);
  const [hasUser, setHasUser] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled) return;
      setHasUser(Boolean(user));
      setLoaded(true);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  if (!loaded) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500">Loading…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap justify-end gap-2 sm:gap-3 min-w-0">
      {hasUser ? (
        <Link href="/dashboard" className="shrink-0">
          <Button variant="primary">Go to Dashboard</Button>
        </Link>
      ) : (
        <>
          <Link href="/login" className="shrink-0">
            <Button variant="outline">Login</Button>
          </Link>
          <Link href="/request-access" className="shrink-0">
            <Button variant="primary">Request Access</Button>
          </Link>
        </>
      )}
    </div>
  );
}


