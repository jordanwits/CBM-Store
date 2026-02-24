import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';

/**
 * Server-side helper to enforce admin-only access
 * Use in Server Actions and API routes to ensure only admins can proceed
 * 
 * @throws Redirects to /login if not authenticated
 * @throws Redirects to /dashboard if authenticated but not admin
 * @returns {supabase, user, profile} for use in server actions
 * 
 * Note: Attempts to use admin client (service role) for write operations to bypass RLS.
 * Falls back to regular client if service role key is not configured.
 */
export async function requireAdmin() {
  const authClient = await createClient();
  
  // Get the current user
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  
  if (authError || !user) {
    redirect('/login');
  }
  
  // Load the user's profile to check role
  const { data: profile, error: profileError } = await authClient
    .from('profiles')
    .select('id, email, full_name, role, active')
    .eq('id', user.id)
    .single();
  
  if (profileError || !profile) {
    redirect('/login');
  }
  
  // Check if user is admin
  if (profile.role !== 'admin' || !profile.active) {
    redirect('/dashboard');
  }
  
  // Try to use admin client (service role) for write operations
  // This bypasses RLS and allows admins to perform operations without
  // worrying about JWT claim synchronization
  let supabase;
  try {
    supabase = createAdminClient();
  } catch (error) {
    // If service role key is not configured, fall back to regular client
    // This will work if the admin's JWT has the proper role claim
    console.warn('Service role key not configured, using regular client for admin operations');
    supabase = authClient;
  }
  
  return { supabase, user, profile };
}
