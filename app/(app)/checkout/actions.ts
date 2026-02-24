'use server';

import { createClient } from '@/lib/supabase/server';
import { getJwtSubject } from '@/lib/auth/jwt';
import { revalidatePath } from 'next/cache';
import type { Cart, CartItem } from '@/lib/cart/types';
import { sendEmail, getAdminEmails } from '@/lib/email/resend';
import { customerOrderConfirmationEmail, adminNewOrderEmail } from '@/lib/email/templates';
import { getStoreSettings, getProductsByIds, getVariantsByProductIds } from '@/lib/cache/store-data';

interface PlaceOrderResult {
  success: boolean;
  orderId?: string;
  error?: string;
}

export interface CheckoutData {
  products: any[];
  variants: any[];
  conversionRate: number;
  pointsBalance: number;
}

// Fetch checkout data based on cart items - only fetches what's needed
export async function getCheckoutData(cartItems: { productId: string; variantId?: string; quantity: number }[]): Promise<CheckoutData> {
  if (cartItems.length === 0) {
    return { products: [], variants: [], conversionRate: 100, pointsBalance: 0 };
  }

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId = session?.access_token ? getJwtSubject(session.access_token) : null;
  if (!userId) {
    return { products: [], variants: [], conversionRate: 100, pointsBalance: 0 };
  }

  const productIds = [...new Set(cartItems.map(item => item.productId))];
  
  // Fetch all data in parallel for maximum speed
  const [settings, products, variants, balanceResult] = await Promise.all([
    getStoreSettings(),
    getProductsByIds(productIds),
    getVariantsByProductIds(productIds),
    supabase.rpc('get_user_points_balance', { p_user_id: userId }),
  ]);

  return {
    products,
    variants,
    conversionRate: settings.conversionRate,
    pointsBalance: balanceResult.data || 0,
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

    // Get delivery method
    const deliveryMethod = formData.get('deliveryMethod') as string;
    if (!deliveryMethod || !['pickup', 'delivery'].includes(deliveryMethod)) {
      return { success: false, error: 'Please select a delivery method' };
    }

    // Get shipping info (only required for delivery)
    const shipName = formData.get('shipName') as string;
    const shipAddressLine1 = formData.get('shipAddressLine1') as string;
    const shipAddressLine2 = (formData.get('shipAddressLine2') as string) || null;
    const shipCity = formData.get('shipCity') as string;
    const shipState = formData.get('shipState') as string;
    const shipZip = formData.get('shipZip') as string;
    const shipCountry = formData.get('shipCountry') as string;

    // Validate shipping fields only for delivery orders
    if (deliveryMethod === 'delivery') {
      if (!shipName || !shipAddressLine1 || !shipCity || !shipState || !shipZip || !shipCountry) {
        return { success: false, error: 'All shipping fields are required for delivery orders' };
      }
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
      p_delivery_method: deliveryMethod,
      p_ship_name: deliveryMethod === 'delivery' ? shipName : null,
      p_ship_address_line1: deliveryMethod === 'delivery' ? shipAddressLine1 : null,
      p_ship_address_line2: deliveryMethod === 'delivery' ? shipAddressLine2 : null,
      p_ship_city: deliveryMethod === 'delivery' ? shipCity : null,
      p_ship_state: deliveryMethod === 'delivery' ? shipState : null,
      p_ship_zip: deliveryMethod === 'delivery' ? shipZip : null,
      p_ship_country: deliveryMethod === 'delivery' ? shipCountry : null,
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
        .select('id, total_points, delivery_method, created_at')
        .eq('id', orderId)
        .single();
      
      if (orderDetails) {
        const orderNumber = orderId.slice(0, 8).toUpperCase();
        const emailData = {
          orderId: orderId,
          orderNumber,
          customerEmail: user.email || '',
          totalPoints: orderDetails.total_points,
          itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
          deliveryMethod: orderDetails.delivery_method,
          createdAt: orderDetails.created_at,
        };
        
        // Send customer confirmation (don't wait)
        sendEmail({
          to: user.email || '',
          ...customerOrderConfirmationEmail(emailData),
        }).catch(err => console.error('Failed to send customer email:', err));
        
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
