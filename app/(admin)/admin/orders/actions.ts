'use server';

import { requireAdmin } from '@/lib/auth/require-admin';
import { revalidatePath } from 'next/cache';
import { sendEmail, getAdminEmails } from '@/lib/email/resend';
import {
  customerOrderStatusEmail,
  adminOrderStatusEmail,
  customerPickupNoticeEmail,
  adminPickupNoticeEmail,
  type PickupNoticeItem,
} from '@/lib/email/templates';
import {
  orderItemVariantLabel,
  ITEM_FULFILLMENT_STATUSES,
  type ItemFulfillmentStatus,
} from '@/lib/orders/fulfillment';

const VALID_STATUSES = ['new', 'processing', 'shipped', 'delivered', 'cancelled'] as const;
type OrderStatus = typeof VALID_STATUSES[number];

interface UpdateOrderStatusData {
  orderId: string;
  status: string;
  trackingNumber?: string;
  notes?: string;
  /**
   * Whether the customer hears about this save. Defaults to "the status actually changed",
   * so correcting a tracking number or adding an internal note no longer re-announces a
   * status the customer was already told about. Passing true re-sends on demand.
   */
  notifyCustomer?: boolean;
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

  // Read before writing: whether the status actually moved decides who gets emailed, and
  // nothing else on the order changes underneath us during a status save.
  const { data: existingOrder } = await supabase
    .from('orders')
    .select('*, profiles(email, phone)')
    .eq('id', data.orderId)
    .single();

  if (!existingOrder) {
    return { success: false, error: 'Order not found' };
  }

  const statusChanged = existingOrder.status !== data.status;

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
    // The customer hears about this only when asked to; the caller's default is
    // "the status moved". Admins get the record whenever it actually moved.
    const notifyCustomer = data.notifyCustomer ?? statusChanged;

    const customerEmail = (existingOrder as any)?.profiles?.email?.trim();
    const customerPhone = (existingOrder as any)?.profiles?.phone?.trim();
    {
      const orderNumber = data.orderId.slice(0, 8).toUpperCase();
      const emailData = {
        orderId: data.orderId,
        orderNumber,
        customerEmail: customerEmail || customerPhone || '(no email on file)',
        totalPoints: existingOrder.total_points,
        itemCount: 0,
        createdAt: existingOrder.created_at,
        status: data.status,
        trackingNumber: data.trackingNumber,
      };

      if (customerEmail && notifyCustomer) {
        sendEmail({
          to: customerEmail,
          ...customerOrderStatusEmail(emailData),
        }).catch(err => console.error('Failed to send customer status email:', err));
      }

      const adminEmails = getAdminEmails();
      if (adminEmails.length > 0 && statusChanged) {
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

interface SendPickupNoticeData {
  orderId: string;
  /** Order item ids the customer can collect now; everything else is still outstanding. */
  readyItemIds: string[];
  note?: string;
}

interface SendPickupNoticeResult {
  success: boolean;
  error?: string;
  /** Sent, but something adjacent did not go to plan and staff should know. */
  warning?: string;
}

/**
 * Tell a customer which lines they can collect, independent of the order's status.
 *
 * An order with a made-to-order line becomes collectable in stages, and the single status
 * field can only describe the order as a whole. This says what is actually ready, so the
 * same action covers "most of it is in" today and "the last piece arrived" next week.
 * It deliberately leaves the status alone — staff decide when the order is done.
 *
 * Unlike the status emails this one is awaited: staff pressed Send, so a failure is theirs
 * to see rather than a line in the server log.
 */
export async function sendPickupNotice(
  data: SendPickupNoticeData
): Promise<SendPickupNoticeResult> {
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');

  if (isDevMode) {
    return { success: false, error: 'Sending notices requires Supabase to be configured.' };
  }

  const { supabase } = await requireAdmin();

  const [orderResult, itemsResult] = await Promise.all([
    supabase
      .from('orders')
      .select('id, total_points, created_at, profiles(email, phone)')
      .eq('id', data.orderId)
      .single(),
    supabase
      .from('order_items')
      .select(
        'id, product_name, variant_name, variant_size, variant_color, quantity, fulfillment_status'
      )
      .eq('order_id', data.orderId),
  ]);

  const order = orderResult.data;

  if (!order) {
    return { success: false, error: 'Order not found' };
  }

  if (itemsResult.error) {
    console.error('Error loading order items for pickup notice:', itemsResult.error);
    return { success: false, error: 'Failed to load the order items' };
  }

  const allItems = itemsResult.data || [];
  const readyIds = new Set(data.readyItemIds);

  const toNoticeItem = (item: (typeof allItems)[number]): PickupNoticeItem => ({
    productName: item.product_name,
    variantLabel: orderItemVariantLabel(item),
    quantity: item.quantity,
  });

  const readyItems = allItems.filter((item) => readyIds.has(item.id)).map(toNoticeItem);

  // A line the customer already collected is not "still coming" — without this, the notice
  // for a late made-to-order item would tell them the things in their hands are outstanding.
  const pendingItems = allItems
    .filter((item) => !readyIds.has(item.id) && item.fulfillment_status !== 'picked_up')
    .map(toNoticeItem);

  if (readyItems.length === 0) {
    return { success: false, error: 'Select at least one item that is ready for pickup.' };
  }

  const customerEmail = (order as any)?.profiles?.email?.trim();

  if (!customerEmail) {
    return {
      success: false,
      error: 'This customer has no email address on file, so they need to be told another way.',
    };
  }

  // No customerDisplayLabel: the phone fallback the status emails use cannot apply here,
  // since a notice is only sent when there is an email address to send it to.
  const noticeData = {
    orderId: data.orderId,
    orderNumber: data.orderId.slice(0, 8).toUpperCase(),
    customerEmail,
    readyItems,
    pendingItems,
    note: data.note?.trim() || undefined,
  };

  const result = await sendEmail({
    to: customerEmail,
    ...customerPickupNoticeEmail(noticeData),
  });

  if (!result.success) {
    return { success: false, error: result.error || 'Failed to send the pickup notice.' };
  }

  const adminEmails = getAdminEmails();
  if (adminEmails.length > 0) {
    sendEmail({
      to: adminEmails,
      ...adminPickupNoticeEmail(noticeData),
    }).catch((err) => console.error('Failed to send admin pickup notice copy:', err));
  }

  // Record what the customer was just told, so it outlives whoever sent it. Only pending
  // lines move: a line already picked up is not un-collected by mentioning it again.
  const idsToMarkReady = allItems
    .filter((item) => readyIds.has(item.id) && item.fulfillment_status === 'pending')
    .map((item) => item.id);

  let warning: string | undefined;

  if (idsToMarkReady.length > 0) {
    const { error: markError } = await supabase
      .from('order_items')
      .update({ fulfillment_status: 'ready' })
      .in('id', idsToMarkReady);

    if (markError) {
      console.error('Pickup notice sent but marking lines ready failed:', markError);
      warning =
        'The email went out, but the items could not be marked ready — set them by hand below.';
    }
  }

  // Email config missing is a silent no-op inside sendEmail, and staff would otherwise
  // walk away believing the customer was told.
  if (result.skipped) {
    warning = 'Email is not configured on this environment, so nothing was actually sent.';
  }

  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${data.orderId}`);
  revalidatePath('/orders');
  revalidatePath(`/orders/${data.orderId}`);

  return { success: true, warning };
}

interface UpdateItemFulfillmentData {
  orderId: string;
  itemId: string;
  status: string;
}

/**
 * Move a single line between not-ready, ready, and picked up.
 *
 * Deliberately silent: the customer hears about readiness through a pickup notice they can
 * read, not through every correction staff make to the board. It also leaves orders.status
 * alone — an order is done when staff say it is, not when the last checkbox flips.
 */
export async function updateItemFulfillment(data: UpdateItemFulfillmentData) {
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');

  if (isDevMode) {
    return { success: false, error: 'Order operations require Supabase to be configured.' };
  }

  if (!ITEM_FULFILLMENT_STATUSES.includes(data.status as ItemFulfillmentStatus)) {
    return { success: false, error: 'Invalid item status' };
  }

  const { supabase } = await requireAdmin();

  // Scoped by order too, so a mistyped id cannot reach a line on someone else's order.
  const { data: updated, error } = await supabase
    .from('order_items')
    .update({ fulfillment_status: data.status })
    .eq('id', data.itemId)
    .eq('order_id', data.orderId)
    .select('id');

  if (error) {
    console.error('Error updating item fulfillment:', error);
    return { success: false, error: 'Failed to update the item' };
  }

  // RLS drops a forbidden update without raising, so an empty result is the only signal
  // that the write did not land.
  if (!updated || updated.length === 0) {
    return { success: false, error: 'Item not found, or you do not have permission to change it' };
  }

  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${data.orderId}`);
  revalidatePath('/orders');
  revalidatePath(`/orders/${data.orderId}`);

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
    .select('id, user_id, total_points, restricted_points_used, universal_points_used')
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

  const totalPts = order.total_points ?? 0;
  let restrictedRefund = Number((order as { restricted_points_used?: number }).restricted_points_used ?? 0);
  let universalRefund = Number((order as { universal_points_used?: number }).universal_points_used ?? 0);
  if (restrictedRefund === 0 && universalRefund === 0 && totalPts > 0) {
    universalRefund = totalPts;
  }

  const reasonBase = `Refund${options.withReturn ? ' (with return)' : ''} for order #${orderId.slice(0, 8).toUpperCase()}`;

  if (restrictedRefund > 0) {
    const { error: rErr } = await supabase.from('points_ledger').insert({
      user_id: order.user_id,
      delta_points: restrictedRefund,
      reason: reasonBase,
      order_id: orderId,
      created_by: user.id,
      point_type: 'restricted',
    });
    if (rErr) {
      console.error('Error refunding CBM points:', rErr);
      return { success: false, error: 'Failed to refund points' };
    }
  }

  if (universalRefund > 0) {
    const { error: uErr } = await supabase.from('points_ledger').insert({
      user_id: order.user_id,
      delta_points: universalRefund,
      reason: reasonBase,
      order_id: orderId,
      created_by: user.id,
      point_type: 'universal',
    });
    if (uErr) {
      console.error('Error refunding universal points:', uErr);
      return { success: false, error: 'Failed to refund points' };
    }
  }

  if (options.withReturn) {
    const { data: items } = await supabase
      .from('order_items')
      .select('variant_id, units_from_stock')
      .eq('order_id', orderId);

    if (items && items.length > 0) {
      for (const item of items) {
        // Put back exactly what left the shelf. A made-to-order line may have drawn some,
        // all, or none of its units from stock, so quantity is the wrong number here.
        const unitsFromStock = item.units_from_stock ?? 0;

        if (item.variant_id && unitsFromStock > 0) {
          const { data: variant } = await supabase
            .from('product_variants')
            .select('inventory_count')
            .eq('id', item.variant_id)
            .single();

          if (variant && variant.inventory_count !== null) {
            await supabase
              .from('product_variants')
              .update({
                inventory_count: variant.inventory_count + unitsFromStock,
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
