'use server';

import { createClient } from '@/lib/supabase/server';
import { getJwtSubject } from '@/lib/auth/jwt';
import { revalidatePath } from 'next/cache';
import type { Cart, CartItem } from '@/lib/cart/types';
import { sendEmail, getAdminEmails } from '@/lib/email/resend';
import { customerOrderConfirmationEmail, adminNewOrderEmail } from '@/lib/email/templates';
import { getStoreSettings, getProductsByIds, getVariantsByProductIds } from '@/lib/cache/store-data';
import { parsePointsBalancesRpc } from '@/lib/points/buckets';

interface PlaceOrderResult {
  success: boolean;
  orderId?: string;
  error?: string;
}

export interface CheckoutData {
  products: any[];
  variants: any[];
  conversionRate: number;
  /** Total points across all buckets (same as legacy single balance) */
  pointsBalance: number;
  universalBalance: number;
  restrictedBalance: number;
}

// Fetch checkout data based on cart items - only fetches what's needed
export async function getCheckoutData(cartItems: { productId: string; variantId?: string; quantity: number }[]): Promise<CheckoutData> {
  if (cartItems.length === 0) {
    return {
      products: [],
      variants: [],
      conversionRate: 100,
      pointsBalance: 0,
      universalBalance: 0,
      restrictedBalance: 0,
    };
  }

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId = session?.access_token ? getJwtSubject(session.access_token) : null;
  if (!userId) {
    return {
      products: [],
      variants: [],
      conversionRate: 100,
      pointsBalance: 0,
      universalBalance: 0,
      restrictedBalance: 0,
    };
  }

  const productIds = [...new Set(cartItems.map(item => item.productId))];
  
  // Fetch all data in parallel for maximum speed
  const [settings, products, variants, balancesResult, legacyTotalResult] = await Promise.all([
    getStoreSettings(),
    getProductsByIds(productIds),
    getVariantsByProductIds(productIds),
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

  return {
    products,
    variants,
    conversionRate: settings.conversionRate,
    pointsBalance,
    universalBalance,
    restrictedBalance,
  };
}

export async function placeOrder(formData: FormData): Promise<PlaceOrderResult> {
  try {
    // Check if using placeholder Supabase (dev mode)
    const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                      process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
    
    if (isDevMode) {
      return { 
        success: false, 
        error: 'Order placement requires Supabase to be configured. Please set up your Supabase project and credentials.' 
      };
    }

    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    // Parse cart data
    const cartJson = formData.get('cart') as string;
    const cart: Cart = JSON.parse(cartJson);

    if (!cart.items || cart.items.length === 0) {
      return { success: false, error: 'Cart is empty' };
    }

    // Normalize and validate cart items
    // Merge duplicates by (productId, variantId) and reject invalid quantities
    const normalizedItems = new Map<string, CartItem>();
    for (const item of cart.items) {
      if (!item.productId || item.quantity <= 0) {
        continue; // Skip invalid items
      }
      
      const key = `${item.productId}-${item.variantId || 'null'}`;
      const existing = normalizedItems.get(key);
      
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        normalizedItems.set(key, { ...item });
      }
    }

    if (normalizedItems.size === 0) {
      return { success: false, error: 'Cart is empty or contains only invalid items' };
    }

    // Prepare items for RPC call
    const items = Array.from(normalizedItems.values()).map((item) => ({
      product_id: item.productId,
      variant_id: item.variantId || null,
      quantity: item.quantity,
    }));

    // Call the transactional RPC to place the order
    const { data: orderId, error: rpcError } = await supabase.rpc('place_points_order', {
      p_items: items,
      p_delivery_method: 'pickup',
      p_ship_name: null,
      p_ship_address_line1: null,
      p_ship_address_line2: null,
      p_ship_city: null,
      p_ship_state: null,
      p_ship_zip: null,
      p_ship_country: null,
    });

    if (rpcError) {
      console.error('Order placement error:', rpcError);
      // Return user-friendly error messages
      if (rpcError.message.includes('Insufficient points')) {
        return { success: false, error: rpcError.message };
      } else if (rpcError.message.includes('not found or inactive')) {
        return { success: false, error: 'One or more items in your cart are no longer available' };
      } else if (rpcError.message.includes('does not belong to product')) {
        return { success: false, error: 'Invalid product variant selected' };
      } else {
        return { success: false, error: 'Failed to place order. Please try again.' };
      }
    }

    if (!orderId) {
      return { success: false, error: 'Failed to create order' };
    }

    // Revalidate affected routes
    revalidatePath('/dashboard');
    revalidatePath('/orders');
    revalidatePath(`/orders/${orderId}`);
    revalidatePath('/cart');
    revalidatePath('/points-history');

    // Send email notifications (failures should not block order completion)
    try {
      // Get order details for email
      const { data: orderDetails } = await supabase
        .from('orders')
        .select('id, total_points, created_at')
        .eq('id', orderId)
        .single();
      
      if (orderDetails) {
        const orderNumber = orderId.slice(0, 8).toUpperCase();
        const customerTo = user.email?.trim();
        const emailData = {
          orderId: orderId,
          orderNumber,
          customerEmail: customerTo || user.phone || '(no email on file)',
          totalPoints: orderDetails.total_points,
          itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
          createdAt: orderDetails.created_at,
        };
        if (customerTo) {
          sendEmail({
            to: customerTo,
            ...customerOrderConfirmationEmail({ ...emailData, customerEmail: customerTo }),
          }).catch(err => console.error('Failed to send customer email:', err));
        }
        
        // Send admin notification (don't wait)
        const adminEmails = getAdminEmails();
        if (adminEmails.length > 0) {
          sendEmail({
            to: adminEmails,
            ...adminNewOrderEmail(emailData),
          }).catch(err => console.error('Failed to send admin email:', err));
        }
      }
    } catch (emailError) {
      // Log but don't fail the order
      console.error('Error sending order emails:', emailError);
    }

    return { success: true, orderId: orderId };
  } catch (error) {
    console.error('Unexpected error in placeOrder:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
