import CheckoutPageClient from './CheckoutPageClient';
import { placeOrder } from './actions';
import { getUserProfile } from '@/lib/auth/get-user';

export default async function CheckoutPage() {
  // Check if using placeholder Supabase (dev mode)
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');

  // Fetch user profile for address auto-fill
  const profile = await getUserProfile();

  return (
    <CheckoutPageClient
      isDevMode={isDevMode}
      placeOrder={placeOrder}
      profileAddress={{
        fullName: profile?.full_name || '',
        addressLine1: profile?.address_line1 || '',
        addressLine2: profile?.address_line2 || '',
        city: profile?.city || '',
        state: profile?.state || '',
        zip: profile?.zip || '',
        country: profile?.country || 'US',
      }}
    />
  );
}
