'use server';

import { getStoreSettings, getProductsByIds, getVariantsByProductIds } from '@/lib/cache/store-data';

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
