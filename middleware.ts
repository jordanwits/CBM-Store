import { type NextRequest } from 'next/server';
import { updateSession } from './lib/supabase/middleware';

// Middleware automatically runs on Edge Runtime in Next.js 15
// This provides faster execution closer to users without explicit runtime export

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
