import { getUserProfile } from '@/lib/auth/get-user';
import { PageHeader } from 'core/components/PageHeader';
import ProfilePageClient from './ProfilePageClient';
import { redirect } from 'next/navigation';

export const revalidate = 0; // Always fetch fresh data for profile page

export default async function ProfilePage() {
  // Check if using placeholder Supabase (dev mode)
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');

  let profile = null;

  if (isDevMode) {
    // Mock profile data for dev mode
    profile = {
      id: 'mock-user-id',
      email: 'demo@cbmplastics.com',
      full_name: 'Demo User',
      role: 'user' as const,
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      address_line1: '123 Main St',
      address_line2: 'Apt 4B',
      city: 'New York',
      state: 'NY',
      zip: '10001',
      country: 'US',
    };
  } else {
    profile = await getUserProfile();
    if (!profile) {
      redirect('/login');
    }
  }

  return (
    <div className="pb-8">
      <PageHeader 
        title="My Profile" 
        subtitle="Manage your personal information and shipping address"
      />
      <ProfilePageClient 
        isDevMode={isDevMode}
        initialProfile={profile}
      />
    </div>
  );
}

