'use server';

import { requireAdmin } from '@/lib/auth/require-admin';
import { revalidatePath } from 'next/cache';
import { sendEmail, getAdminEmails } from '@/lib/email/resend';
import { customerOrderStatusEmail, adminOrderStatusEmail } from '@/lib/email/templates';

const VALID_STATUSES = ['new', 'processing', 'shipped', 'delivered', 'cancelled'] as const;
type OrderStatus = typeof VALID_STATUSES[number];

interface UpdateOrderStatusData {
  orderId: string;
  status: string;
  trackingNumber?: string;
  notes?: string;
}

export async function updateOrderStatus(data: UpdateOrderStatusData) {
  // Check if using placeholder Supabase (dev mode)
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  
  if (isDevMode) {
    return { 
      success: false, 
      error: 'Order status updates require Supabase to be configured.' 
    };
  }

  const { supabase } = await requireAdmin();
  
  // Validate status
  if (!VALID_STATUSES.includes(data.status as OrderStatus)) {
    return { success: false, error: 'Invalid order status' };
  }
  
  // Build update object
  const updateData: any = {
    status: data.status,
  };
  
  if (data.trackingNumber !== undefined) {
    updateData.tracking_number = data.trackingNumber || null;
  }
  
  if (data.notes !== undefined) {
    updateData.notes = data.notes || null;
  }
  
  const { error } = await supabase
    .from('orders')
    .update(updateData)
    .eq('id', data.orderId);
  
  if (error) {
    console.error('Error updating order status:', error);
    return { success: false, error: 'Failed to update order status' };
  }
  
  // Revalidate relevant pages
  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${data.orderId}`);
  revalidatePath('/orders');
  revalidatePath(`/orders/${data.orderId}`);
  
  // Send email notifications (failures should not block status update)
  try {
    // Get order details with user email
    const { data: orderDetails } = await supabase
      .from('orders')
      .select('*, profiles(email)')
      .eq('id', data.orderId)
      .single();
    
    if (orderDetails && (orderDetails as any).profiles?.email) {
      const orderNumber = data.orderId.slice(0, 8).toUpperCase();
      const emailData = {
        orderId: data.orderId,
        orderNumber,
        customerEmail: (orderDetails as any).profiles.email,
        totalPoints: orderDetails.total_points,
        itemCount: 0, // Not critical for status update
        deliveryMethod: orderDetails.delivery_method,
        createdAt: orderDetails.created_at,
        status: data.status,
        trackingNumber: data.trackingNumber,
      };
      
      // Send customer notification (don't wait)
      sendEmail({
        to: (orderDetails as any).profiles.email,
        ...customerOrderStatusEmail(emailData),
      }).catch(err => console.error('Failed to send customer status email:', err));
      
      // Send admin notification (don't wait)
      const adminEmails = getAdminEmails();
      if (adminEmails.length > 0) {
        sendEmail({
          to: adminEmails,
          ...adminOrderStatusEmail(emailData),
        }).catch(err => console.error('Failed to send admin status email:', err));
      }
    }
  } catch (emailError) {
    // Log but don't fail the status update
    console.error('Error sending status update emails:', emailError);
  }
  
  return { success: true };
}

export async function deleteOrder(orderId: string) {
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');

  if (isDevMode) {
    return { success: false, error: 'Order operations require Supabase to be configured.' };
  }

  const { supabase } = await requireAdmin();

  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('id')
    .eq('id', orderId)
    .single();

  if (fetchError || !order) {
    return { success: false, error: 'Order not found' };
  }

  const { error: deleteError } = await supabase.from('orders').delete().eq('id', orderId);

  if (deleteError) {
    console.error('Error deleting order:', deleteError);
    return { success: false, error: 'Failed to delete order' };
  }

  revalidatePath('/admin/orders');
  revalidatePath('/orders');
  return { success: true };
}

export async function refundOrder(
  orderId: string,
  options: { withReturn: boolean }
) {
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');

  if (isDevMode) {
    return { success: false, error: 'Order operations require Supabase to be configured.' };
  }

  const { supabase, user } = await requireAdmin();

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, user_id, total_points')
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    return { success: false, error: 'Order not found' };
  }

  // Prevent double refund
  const { data: existingRefunds } = await supabase
    .from('points_ledger')
    .select('id')
    .eq('order_id', orderId)
    .gt('delta_points', 0);

  if (existingRefunds && existingRefunds.length > 0) {
    return { success: false, error: 'This order has already been refunded' };
  }

  // Refund points
  const { error: refundError } = await supabase.from('points_ledger').insert({
    user_id: order.user_id,
    delta_points: order.total_points,
    reason: `Refund${options.withReturn ? ' (with return)' : ''} for order #${orderId.slice(0, 8).toUpperCase()}`,
    order_id: orderId,
    created_by: user.id,
  });

  if (refundError) {
    console.error('Error refunding points:', refundError);
    return { success: false, error: 'Failed to refund points' };
  }

  if (options.withReturn) {
    const { data: items } = await supabase
      .from('order_items')
      .select('variant_id, quantity')
      .eq('order_id', orderId);

    if (items && items.length > 0) {
      for (const item of items) {
        if (item.variant_id) {
          const { data: variant } = await supabase
            .from('product_variants')
            .select('inventory_count')
            .eq('id', item.variant_id)
            .single();

          if (variant && variant.inventory_count !== null) {
            await supabase
              .from('product_variants')
              .update({
                inventory_count: variant.inventory_count + item.quantity,
              })
              .eq('id', item.variant_id);
          }
        }
      }
    }
  }

  // Mark order as cancelled
  await supabase
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('id', orderId);

  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath('/orders');
  revalidatePath(`/orders/${orderId}`);
  return { success: true };
}
