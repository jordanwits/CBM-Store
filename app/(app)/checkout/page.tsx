import CheckoutPageClient from './CheckoutPageClient';
import { placeOrder } from './actions';

export default async function CheckoutPage() {
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL ||
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');

  return (
    <CheckoutPageClient
      isDevMode={isDevMode}
      placeOrder={placeOrder}
    />
  );
}
