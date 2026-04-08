'use server';

import { createClient } from '@/lib/supabase/server';
import { getJwtSubject } from '@/lib/auth/jwt';
import { getStoreSettings, getProductsByIds, getVariantsByProductIds } from '@/lib/cache/store-data';
import { parsePointsBalancesRpc } from '@/lib/points/buckets';

interface CartItem {
  productId: string;
  variantId?: string;
  quantity: number;
}

export interface CartProductData {
  products: any[];
  variants: any[];
  conversionRate: number;
}

// Fetch only the products and variants that are in the cart
export async function getCartProductData(cartItems: CartItem[]): Promise<CartProductData> {
  if (cartItems.length === 0) {
    return { products: [], variants: [], conversionRate: 100 };
  }

  // Get unique product IDs from cart
  const productIds = [...new Set(cartItems.map(item => item.productId))];
  
  // Fetch all data in parallel for maximum speed
  const [settings, products, variants] = await Promise.all([
    getStoreSettings(),
    getProductsByIds(productIds),
    getVariantsByProductIds(productIds),
  ]);

  return {
    products,
    variants,
    conversionRate: settings.conversionRate,
  };
}

export interface CartBalances {
  pointsBalance: number;
  universalBalance: number;
  restrictedBalance: number;
}

/** Current user point buckets for cart spend preview; null if not signed in. */
export async function getCartBalances(): Promise<CartBalances | null> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId = session?.access_token ? getJwtSubject(session.access_token) : null;
  if (!userId) return null;

  const [balancesResult, legacyTotalResult] = await Promise.all([
    supabase.rpc('get_user_points_balances', { p_user_id: userId }),
    supabase.rpc('get_user_points_balance', { p_user_id: userId }),
  ]);

  let universalBalance = 0;
  let restrictedBalance = 0;
  let pointsBalance = legacyTotalResult.data || 0;

  if (!balancesResult.error && balancesResult.data != null) {
    const b = parsePointsBalancesRpc(balancesResult.data);
    universalBalance = b.universal;
    restrictedBalance = b.restricted;
    pointsBalance = b.total;
  } else {
    universalBalance = pointsBalance;
    restrictedBalance = 0;
  }

  return { pointsBalance, universalBalance, restrictedBalance };
}
