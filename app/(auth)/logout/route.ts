import { createClient } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  
  // Attempt to sign out, but don't fail if token is already invalid/cleared
  const { error } = await supabase.auth.signOut();
  
  // Ignore "Refresh Token Not Found" errors - token may already be cleared
  // This is fine, we just want to ensure cookies are cleared and redirect
  if (error && !error.message.includes('Refresh Token Not Found')) {
    console.error('Logout error:', error);
  }
  
  // Use the request origin to build absolute URL for redirect
  const loginUrl = `${request.nextUrl.origin}/login`;
  const response = NextResponse.redirect(loginUrl, { status: 303 });
  
  return response;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  
  // Attempt to sign out, but don't fail if token is already invalid/cleared
  const { error } = await supabase.auth.signOut();
  
  // Ignore "Refresh Token Not Found" errors - token may already be cleared
  // This is fine, we just want to ensure cookies are cleared and redirect
  if (error && !error.message.includes('Refresh Token Not Found')) {
    console.error('Logout error:', error);
  }
  
  // Use the request origin to build absolute URL for redirect
  const loginUrl = `${request.nextUrl.origin}/login`;
  const response = NextResponse.redirect(loginUrl, { status: 303 });
  
  return response;
}
