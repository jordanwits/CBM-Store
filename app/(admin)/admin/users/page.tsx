import { UsersPageClient } from './UsersPageClient';
import { requireAdmin } from '@/lib/auth/require-admin';

export default async function AdminUsersPage() {
  // Check if using placeholder Supabase (dev mode)
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  
  let users: any[] = [];
  let accessRequests: any[] = [];
  let currentAdminId: string | undefined;
  
  if (!isDevMode) {
    const { supabase, user } = await requireAdmin();
    currentAdminId = user.id;

    // Get all users
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id,email,full_name,role,active,created_at')
      .order('created_at', { ascending: false });
    
    // Get point balances for all users efficiently
    const { data: pointsData } = await supabase
      .from('points_ledger')
      .select('user_id, delta_points');
    
    // Calculate balances by user
    const balancesMap = new Map<string, number>();
    if (pointsData) {
      pointsData.forEach((entry: any) => {
        const current = balancesMap.get(entry.user_id) || 0;
        balancesMap.set(entry.user_id, current + entry.delta_points);
      });
    }
    
    // Combine users with their point balances
    users = (profilesData || []).map((profile: any) => ({
      ...profile,
      points_balance: balancesMap.get(profile.id) || 0,
    }));

    // Get pending access requests
    const { data: requests } = await supabase
      .from('access_requests')
      .select('id,email,full_name,message,status,created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    
    accessRequests = requests || [];
  } else {
    // Mock data for dev mode
    users = [
      {
        id: '1',
        email: 'admin@cbmplastics.com',
        full_name: 'Admin User',
        role: 'admin',
        active: true,
        created_at: new Date().toISOString(),
        points_balance: 0,
      },
      {
        id: '2',
        email: 'user@cbmplastics.com',
        full_name: 'Test User',
        role: 'user',
        active: true,
        created_at: new Date().toISOString(),
        points_balance: 0,
      },
    ];
    // Mock access requests for dev mode
    accessRequests = [
      {
        id: 'req-1',
        email: 'newuser@example.com',
        full_name: 'New User Request',
        message: 'I would like access to the rewards platform.',
        status: 'pending',
        created_at: new Date().toISOString(),
      },
    ];
  }

  return <UsersPageClient isDevMode={isDevMode} users={users} accessRequests={accessRequests} currentAdminId={currentAdminId} />;
}
