import CartPageClient from './CartPageClient';

export default async function CartPage() {
  // Check if using placeholder Supabase (dev mode)
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');

  // No more heavy data fetching on server!
  // The client will fetch only the products it needs via a server action
  return <CartPageClient isDevMode={isDevMode} />;
}
