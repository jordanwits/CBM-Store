import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const pathname = request.nextUrl.pathname;

  // Only run Supabase session refresh logic on routes that actually need auth state.
  // This avoids a network roundtrip on marketing/static pages and reduces click-to-open latency.
  const isAppRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/catalog') ||
    pathname.startsWith('/product') ||
    pathname.startsWith('/cart') ||
    pathname.startsWith('/checkout') ||
    pathname.startsWith('/orders') ||
    pathname.startsWith('/points-history') ||
    pathname.startsWith('/admin');

  const isAuthRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/logout') ||
    pathname.startsWith('/update-password') ||
    pathname.startsWith('/forgot-password');

  if (!isAppRoute && !isAuthRoute) {
    return supabaseResponse;
  }

  // Use placeholder values if not configured (dev mode)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MDAsImV4cCI6MTk2MDc2ODgwMH0.placeholder';

  // If using placeholder credentials, skip auth checks (dev mode)
  if (url.includes('placeholder')) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
        cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Avoid calling the Supabase Auth API on every request.
  // We can usually trust the session cookie and only refresh when nearing expiry.
  const refreshGraceMs = 2 * 60 * 1000; // refresh if expiring in next 2 minutes

  let session;
  try {
    const sessionResult = await supabase.auth.getSession();
    session = sessionResult.data?.session;
  } catch (error) {
    // If session retrieval fails (e.g., invalid refresh token), treat as unauthenticated
    session = null;
  }

  const expiresAtMs = session?.expires_at ? session.expires_at * 1000 : 0;
  const shouldRefresh = !session || (expiresAtMs > 0 && expiresAtMs - Date.now() < refreshGraceMs);

  let isAuthenticated = Boolean(session?.access_token);

  if (shouldRefresh) {
    try {
      const {
        data: { user: refreshedUser },
      } = await supabase.auth.getUser();
      isAuthenticated = Boolean(refreshedUser);
    } catch (error) {
      // If refresh fails (e.g., invalid refresh token), treat as unauthenticated
      // This is expected after logout or token expiration
      isAuthenticated = false;
    }
  }

  if (isAppRoute && !isAuthenticated) {
    // Redirect to login if trying to access protected route without auth
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && isAuthenticated) {
    // Redirect to dashboard if already logged in and trying to access login
    // But allow /update-password to process password reset tokens
    if (request.nextUrl.pathname === '/login') {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
