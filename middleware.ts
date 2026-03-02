import { type NextRequest } from 'next/server';
import { updateSession } from './lib/supabase/middleware';

// Middleware automatically runs on Edge Runtime in Next.js 15
// This provides faster execution closer to users without explicit runtime export

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Exclude all Next.js internals (_next), static assets, and API routes
    '/((?!_next|api|favicon.ico|monitoring|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
};
