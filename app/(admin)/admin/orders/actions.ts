'use server';

import { requireAdmin } from '@/lib/auth/require-admin';
import { revalidatePath, revalidateTag } from 'next/cache';
import { after } from 'next/server';
import { sendEmail, getAdminEmails, deliverableEmail } from '@/lib/email/resend';
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
  isItemAwaitingReady,
  isItemRefunded,
  type ItemFulfillmentStatus,
} from '@/lib/orders/fulfillment';
import { normalizeOrderNote, ORDER_NOTE_MAX_LENGTH } from '@/lib/orders/notes';

const VALID_STATUSES = ['new', 'processing', 'shipped', 'delivered', 'cancelled'] as const;
type OrderStatus = typeof VALID_STATUSES[number];

interface UpdateOrderStatusData {
  orderId: string;
  status: string;
  trackingNumber?: string;
  /**
   * Whether the customer hears about this save. Defaults to "the status actually changed",
   * so correcting a tracking number no longer re-announces a status the customer was
   * already told about. Passing true re-sends on demand.
   */
  notifyCustomer?: boolean;
}

interface UpdateOrderStatusResult {
  success: boolean;
  error?: string;
  /**
   * Whether a status email to the customer was sent off. False when it was not asked for,
   * and also when the customer has no real address (a phone-only account), so the editor
   * never tells staff someone was emailed when nobody was.
   */
  customerEmailed?: boolean;
}

export async function updateOrderStatus(
  data: UpdateOrderStatusData
): Promise<UpdateOrderStatusResult> {
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

  // Marking the whole order ready for pickup (or picked up) moves its lines along with it,
  // and a made-to-order line's made units leave inventory as it does (migration 037). The
  // storefront quotes stock, so its cached variant rows have to go too.
  if (statusChanged && (data.status === 'shipped' || data.status === 'delivered')) {
    revalidateTag('product-variants');
  }

  // The customer hears about this only when asked to; the caller's default is "the status
  // moved". A phone-only customer has no real address, so there is no one to email.
  const notifyCustomer = data.notifyCustomer ?? statusChanged;
  const customerEmail = deliverableEmail((existingOrder as any)?.profiles?.email);
  const customerEmailed = Boolean(customerEmail && notifyCustomer);

  // Send email notifications (failures should not block status update)
  try {
    // Admins get the record whenever the status actually moved.
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

      const adminEmails = getAdminEmails();

      // after() keeps the function alive until the sends finish; a bare unawaited promise
      // can be cut off once the response has gone out. sendEmail logs its own failures.
      after(async () => {
        await Promise.all([
          customerEmailed && customerEmail
            ? sendEmail({
                to: customerEmail,
                ...customerOrderStatusEmail(emailData),
              })
            : null,
          adminEmails.length > 0 && statusChanged
            ? sendEmail({
                to: adminEmails,
                ...adminOrderStatusEmail(emailData),
              })
            : null,
        ]);
      });
    }
  } catch (emailError) {
    // Log but don't fail the status update
    console.error('Error sending status update emails:', emailError);
  }

  return { success: true, customerEmailed };
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
        'id, product_name, variant_name, variant_size, variant_color, quantity, fulfillment_status, made_to_order'
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

  // A refunded line is no longer part of the order: it is neither ready nor still coming
  const allItems = (itemsResult.data || []).filter(
    (item) => !isItemRefunded(item.fulfillment_status)
  );
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

  // A phone-only account's address is a placeholder, so it counts as no email at all
  const customerEmail = deliverableEmail((order as any)?.profiles?.email);

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
    // The admin copy is a record, not something staff wait on, but it still has to be
    // allowed to finish after the response goes out
    after(async () => {
      await sendEmail({
        to: adminEmails,
        ...adminPickupNoticeEmail(noticeData),
      });
    });
  }

  // Record what the customer was just told, so it outlives whoever sent it. Only lines not
  // yet ready move (not ready, or ordered and now arrived): a line already picked up is not
  // un-collected by mentioning it again.
  const linesToMarkReady = allItems.filter(
    (item) => readyIds.has(item.id) && isItemAwaitingReady(item.fulfillment_status)
  );
  const idsToMarkReady = linesToMarkReady.map((item) => item.id);

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
    } else if (linesToMarkReady.some((item) => item.made_to_order)) {
      // A made-to-order line marked ready takes its made units out of inventory
      // (migration 037), and the storefront's cached stock has to follow
      revalidateTag('product-variants');
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
 *
 * Not silent on inventory: a made-to-order line leaving "not ready" takes its made units out
 * of stock, and going back puts them back. The database does that (migration 037), so it
 * happens the same way however the line is moved.
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
    .select('id, made_to_order');

  if (error) {
    console.error('Error updating item fulfillment:', error);

    // A refunded line is locked in the database (041)
    if (error.message.includes('has been refunded')) {
      return { success: false, error: error.message };
    }

    return { success: false, error: 'Failed to update the item' };
  }

  // RLS drops a forbidden update without raising, so an empty result is the only signal
  // that the write did not land.
  if (!updated || updated.length === 0) {
    return { success: false, error: 'Item not found, or you do not have permission to change it' };
  }

  if (updated[0].made_to_order) {
    revalidateTag('product-variants');
  }

  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${data.orderId}`);
  revalidatePath('/orders');
  revalidatePath(`/orders/${data.orderId}`);

  return { success: true };
}

/**
 * Save what staff have written about an order.
 *
 * This used to ride along with a status save, which meant a note could only be changed
 * from inside the status form and clearing one did nothing. It is its own save now, and it
 * never emails anyone: these notes are for staff, and customers do not see them.
 */
export async function updateOrderNotes(data: { orderId: string; notes: string }) {
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');

  if (isDevMode) {
    return { success: false, error: 'Order operations require Supabase to be configured.' };
  }

  const notes = normalizeOrderNote(data.notes);

  if (notes && notes.length > ORDER_NOTE_MAX_LENGTH) {
    return {
      success: false,
      error: `Notes can be at most ${ORDER_NOTE_MAX_LENGTH} characters.`,
    };
  }

  const { supabase } = await requireAdmin();

  const { data: updated, error } = await supabase
    .from('orders')
    .update({ notes })
    .eq('id', data.orderId)
    .select('id');

  if (error) {
    console.error('Error updating order notes:', error);
    return { success: false, error: 'Failed to save the notes' };
  }

  // RLS drops a forbidden update without raising, so an empty result is the only signal
  // that the write did not land.
  if (!updated || updated.length === 0) {
    return { success: false, error: 'Order not found, or you do not have permission to change it' };
  }

  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${data.orderId}`);

  return { success: true };
}

/**
 * Delete an order. The database copies it into deleted_orders first (migration 038), so an
 * admin can bring it back from the Deleted orders page.
 */
export async function deleteOrder(orderId: string) {
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');

  if (isDevMode) {
    return { success: false, error: 'Order operations require Supabase to be configured.' };
  }

  const { supabase, user } = await requireAdmin();

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

  // The trigger that made the copy runs as whoever issued the delete, which here is usually
  // the service role, where it cannot tell which admin pressed the button. Stamp it from the
  // session instead. Losing this only blanks the "deleted by" column, so it does not fail the
  // delete that already happened.
  const { error: stampError } = await supabase
    .from('deleted_orders')
    .update({ deleted_by: user.id })
    .eq('order_id', orderId);

  if (stampError) {
    console.error('Order deleted but recording who deleted it failed:', stampError);
  }

  revalidatePath('/admin/orders');
  revalidatePath('/admin/orders/deleted');
  revalidatePath('/orders');
  return { success: true };
}

/**
 * Bring a deleted order back, lines and all, from the deleted_orders bin.
 *
 * Inventory and points are left alone, because deleting never touched them: the points the
 * customer spent stayed deducted the whole time, and line up with the order again now.
 */
export async function restoreDeletedOrder(orderId: string) {
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');

  if (isDevMode) {
    return { success: false, error: 'Order operations require Supabase to be configured.' };
  }

  const { supabase } = await requireAdmin();

  const { error } = await supabase.rpc('restore_deleted_order', { p_order_id: orderId });

  if (error) {
    console.error('Error restoring order:', error);

    // The function's own messages are written for staff: say which part blocks the restore
    const knownReasons = [
      'not in the deleted orders list',
      'already exists',
      'no longer has an account',
      'has since been deleted',
    ];

    if (knownReasons.some((reason) => error.message.includes(reason))) {
      return { success: false, error: error.message };
    }

    return { success: false, error: 'Failed to restore the order' };
  }

  revalidatePath('/admin/orders');
  revalidatePath('/admin/orders/deleted');
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath('/orders');
  revalidatePath(`/orders/${orderId}`);

  return { success: true };
}

/**
 * The refund functions' own messages are written for staff: say which part blocks the refund
 * rather than a generic failure.
 */
function refundErrorMessage(message: string, fallback: string): string {
  const knownReasons = [
    'already been refunded',
    'left to refund',
    'not on this order',
    'Order not found',
  ];

  return knownReasons.some((reason) => message.includes(reason)) ? message : fallback;
}

function revalidateRefundedOrder(orderId: string, withReturn: boolean) {
  // Returned units go back on the shelf, and the storefront quotes stock to customers, so
  // the cached variant rows behind the catalog and product pages have to be dropped with
  // them. Only the return path touches inventory; a plain refund leaves it alone.
  if (withReturn) {
    revalidateTag('product-variants');
  }

  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath('/orders');
  revalidatePath(`/orders/${orderId}`);
  revalidatePath('/points-history');
}

/**
 * Refund everything on the order that has not been refunded yet, and cancel it.
 *
 * The database does the work (refund_order, migration 041) in one transaction: each line
 * still on the order is refunded the way a single line would be, with return putting back
 * exactly the units it took from stock, so an order with some lines already refunded gives
 * back only the rest.
 */
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

  const { data: refundedPoints, error } = await supabase.rpc('refund_order', {
    p_order_id: orderId,
    p_with_return: options.withReturn,
    p_refunded_by: user.id,
  });

  if (error) {
    console.error('Error refunding order:', error);
    return { success: false, error: refundErrorMessage(error.message, 'Failed to refund the order') };
  }

  revalidateRefundedOrder(orderId, options.withReturn);
  return { success: true, refundedPoints: Number(refundedPoints ?? 0) };
}

/**
 * Refund one line of an order: its points go back to the customer and the line is marked
 * refunded, while the rest of the order carries on. For the item a supplier cannot provide.
 *
 * The database does the work (refund_order_item, migration 041). A line in the CBM
 * collection gives back restricted points first, as checkout spent them first; any other
 * line gives back universal. Refunding the last line left cancels the order.
 */
export async function refundOrderItem(
  orderId: string,
  itemId: string,
  options: { withReturn: boolean }
) {
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');

  if (isDevMode) {
    return { success: false, error: 'Order operations require Supabase to be configured.' };
  }

  const { supabase, user } = await requireAdmin();

  const { data: refundedPoints, error } = await supabase.rpc('refund_order_item', {
    p_order_id: orderId,
    p_item_id: itemId,
    p_with_return: options.withReturn,
    p_refunded_by: user.id,
  });

  if (error) {
    console.error('Error refunding order item:', error);
    return { success: false, error: refundErrorMessage(error.message, 'Failed to refund the item') };
  }

  revalidateRefundedOrder(orderId, options.withReturn);
  return { success: true, refundedPoints: Number(refundedPoints ?? 0) };
}
