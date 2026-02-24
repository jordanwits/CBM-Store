import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminLayoutClient } from './AdminLayoutClient';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  // Check if using placeholder Supabase (dev mode)
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  
  // In non-dev mode, enforce admin access
  if (!isDevMode) {
    await requireAdmin();
  }

  return <AdminLayoutClient isDevMode={isDevMode}>{children}</AdminLayoutClient>;
}
