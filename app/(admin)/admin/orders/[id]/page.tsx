import { requireAdmin } from '@/lib/auth/require-admin';
import { Card, CardHeader, CardContent } from 'core/components/Card';
import { BackButton } from 'core/components/BackButton';
import { FormattedDate } from 'core/components/FormattedDate';
import { orderStatusLabel, orderStatusPillClasses } from '@/lib/orders/status';
import {
  isItemRefunded,
  itemFulfillmentPillClasses,
  orderItemProcurement,
  orderItemReadyStockNote,
  orderItemVariantLabel,
  summarizeFulfillment,
  unitsToMake,
} from '@/lib/orders/fulfillment';
import { orderItemRefundedPoints, summarizeOrderRefunds } from '@/lib/orders/refunds';
import { notFound } from 'next/navigation';
import { OrderStatusEditor } from './OrderStatusEditor';
import { OrderActions } from './OrderActions';
import { PickupNoticeSender } from './PickupNoticeSender';
import { ItemFulfillmentSelect } from './ItemFulfillmentSelect';
import { ItemRefundButton } from './ItemRefundButton';
import { StaffNotesEditor } from './StaffNotesEditor';
import { getTrackingUrl } from '@/lib/tracking';
import Link from 'next/link';

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  
  // Check if using placeholder Supabase (dev mode)
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  
  if (isDevMode) {
    notFound();
  }
  
  // The service role, as every admin action uses: staff notes are not readable by signed-in
  // users (migration 045), and that includes an admin's own session
  const { supabase } = await requireAdmin();

  // Run queries in parallel for faster loading
  const [orderResult, itemsResult, ledgerRefunds] = await Promise.all([
    supabase
      .from('orders')
      .select('*, profiles(email, phone, full_name)')
      .eq('id', id)
      .single(),
    supabase
      .from('order_items')
      // The variant's live count says whether marking a made-to-order line ready will take
      // anything from inventory (an untracked variant has nothing to take)
      .select('*, product_variants(inventory_count)')
      .eq('order_id', id),
    // Every refund for the order, line or whole, is a positive ledger row against it
    supabase
      .from('points_ledger')
      .select('delta_points, point_type')
      .eq('order_id', id)
      .gt('delta_points', 0),
  ]);

  if (!orderResult.data) {
    notFound();
  }

  const order = orderResult.data;
  const items = itemsResult.data || [];
  const refunds = summarizeOrderRefunds(order, ledgerRefunds.data ?? []);
  const fulfillment = summarizeFulfillment(items);
  // Refunded lines are no longer part of what the customer is told about
  const activeItems = items.filter((item) => !isItemRefunded(item.fulfillment_status));

  return (
    <div className="px-4 py-6 sm:px-0">
      <BackButton href="/admin/orders" label="Back to Orders" className="mb-4" />
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-8">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Order #{order.id.slice(0, 8).toUpperCase()}
          </h1>
          <p className="text-gray-700">
            Placed on <FormattedDate date={order.created_at} format="datetimeShort" />
          </p>
        </div>
        <div className="flex flex-col gap-4 items-stretch sm:items-end w-full sm:w-auto">
          {/* Keyed on what it edits, so a refresh after a refund or a save starts it afresh */}
          <OrderStatusEditor
            key={`${order.status}|${order.tracking_number ?? ''}|${refunds.left}`}
            orderId={order.id}
            currentStatus={order.status}
            currentTrackingNumber={order.tracking_number}
            refunds={refunds}
            isDevMode={isDevMode}
          />
          <OrderActions
            orderId={order.id}
            isDevMode={isDevMode}
            isAlreadyRefunded={refunds.isFullyRefunded}
            isPartiallyRefunded={refunds.isPartiallyRefunded}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Customer Information</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-gray-700 font-medium">Email / phone</p>
                <p className="font-medium text-gray-900 mt-1">
                  {(order as any).profiles?.email?.trim() ||
                    (order as any).profiles?.phone?.trim() ||
                    'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-700 font-medium">Full Name</p>
                <p className="font-medium text-gray-900 mt-1">{(order as any).profiles?.full_name || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Order Status</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-gray-700 font-medium">Fulfillment</p>
                <span className="inline-block mt-1 px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-900">
                  Store pickup
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-700 font-medium">Current Status</p>
                <span
                  className={`inline-block mt-1 px-3 py-1 rounded-full text-sm font-medium ${orderStatusPillClasses(order.status)}`}
                >
                  {orderStatusLabel(order.status)}
                </span>
              </div>
              {fulfillment.total > 0 && order.status !== 'cancelled' && (
                <div>
                  <p className="text-sm text-gray-700 font-medium">Items</p>
                  <p className="mt-1 text-gray-900">
                    {fulfillment.pickedUp} picked up · {fulfillment.ready} ready ·{' '}
                    {fulfillment.ordered > 0 && <>{fulfillment.ordered} ordered · </>}
                    {fulfillment.pending - fulfillment.ordered} not ready
                    {fulfillment.refunded > 0 && <> · {fulfillment.refunded} refunded</>}
                  </p>
                  {fulfillment.isPartiallyFulfilled && (
                    <span className="inline-block mt-1 px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-900">
                      {fulfillment.outstanding} outstanding
                    </span>
                  )}
                </div>
              )}
              {order.tracking_number && (
                <div>
                  <p className="text-sm text-gray-700 font-medium">Reference</p>
                  <Link 
                    href={getTrackingUrl(order.tracking_number)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium font-mono text-blue-600 hover:text-blue-800 hover:underline mt-1 inline-block"
                  >
                    {order.tracking_number}
                    <svg className="w-4 h-4 inline-block ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </Link>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-700 font-medium">Total Points</p>
                <p className="text-2xl font-bold text-blue-700 mt-1">{order.total_points}</p>
                <p className="text-xs text-gray-600 mt-1">
                  CBM points {(order as { restricted_points_used?: number }).restricted_points_used ?? 0} ·
                  Universal{' '}
                  {(order as { universal_points_used?: number }).universal_points_used ?? 0}
                </p>
                {refunds.refunded > 0 && (
                  <p className="text-sm font-medium text-rose-800 mt-2">
                    {refunds.refunded} refunded
                    <span className="block text-xs font-normal text-gray-600 mt-0.5">
                      CBM points {refunds.refundedRestricted} · Universal {refunds.refundedUniversal}
                    </span>
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Notes</h2>
        </CardHeader>
        <CardContent>
          <div className="space-y-5">
            {order.customer_note && (
              <div>
                <p className="text-sm text-gray-700 font-medium mb-1">From the customer</p>
                <p className="rounded-md border border-blue-200 bg-blue-50 p-3 text-gray-900 whitespace-pre-wrap break-words">
                  {order.customer_note}
                </p>
              </div>
            )}
            <div>
              <p className="text-sm text-gray-700 font-medium mb-1">Staff notes</p>
              <StaffNotesEditor
                orderId={order.id}
                currentNotes={order.notes ?? null}
                isDevMode={isDevMode}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Pickup Information</h2>
        </CardHeader>
        <CardContent>
          <p className="text-gray-800">This order will be picked up at our location.</p>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Order Items</h2>
        </CardHeader>
        <CardContent>
          {items && items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase bg-gray-50">
                      Product
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase bg-gray-50">
                      Size
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase bg-gray-50">
                      Color
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase bg-gray-50">
                      Qty
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase bg-gray-50">
                      Points/Unit
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase bg-gray-50">
                      Total
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase bg-gray-50">
                      Fulfillment
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.map((item) => {
                    const procurement = orderItemProcurement(item);
                    const variantInventory = (item as any).product_variants?.inventory_count;
                    const readyStockNote = orderItemReadyStockNote(item, variantInventory);
                    const refunded = isItemRefunded(item.fulfillment_status);
                    // What a refund with return would put back: checkout's draw plus the
                    // made units taken at ready, and only into a variant that counts stock
                    const unitsOffShelf =
                      (item.units_from_stock ?? 0) + (item.units_from_stock_at_ready ?? 0);

                    return (
                      <tr key={item.id} className={refunded ? 'bg-gray-50' : undefined}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {item.product_name}
                          {procurement && (
                            <span
                              className={`ml-2 inline-block px-2 py-0.5 rounded-full text-xs font-medium align-middle ${procurement.pillClasses}`}
                            >
                              {procurement.label}
                            </span>
                          )}
                          {/* A variant with neither dimension carries its meaning in the name alone */}
                          {!item.variant_size && !item.variant_color && item.variant_name && (
                            <span className="block text-xs font-normal text-gray-700 mt-0.5">
                              {item.variant_name}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-800">{item.variant_size || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-800">{item.variant_color || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{item.quantity}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{item.points_per_item}</td>
                        <td
                          className={`px-4 py-3 text-sm font-semibold ${
                            refunded ? 'text-gray-500 line-through' : 'text-gray-900'
                          }`}
                        >
                          {item.total_points}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {refunded ? (
                            <div>
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${itemFulfillmentPillClasses(item.fulfillment_status)}`}
                              >
                                Refunded
                              </span>
                              <span className="block text-xs text-gray-700 mt-1">
                                {orderItemRefundedPoints(item)} pts returned
                                {item.refunded_with_return && unitsOffShelf > 0 && ', stock put back'}
                              </span>
                              {item.refunded_at && (
                                <span className="block text-xs text-gray-600">
                                  <FormattedDate date={item.refunded_at} format="datetimeShort" />
                                </span>
                              )}
                            </div>
                          ) : (
                            <>
                              <ItemFulfillmentSelect
                                key={`${item.id}|${item.fulfillment_status}`}
                                orderId={order.id}
                                itemId={item.id}
                                currentStatus={item.fulfillment_status ?? 'pending'}
                                canBeOrdered={unitsToMake(item) > 0}
                                disabled={isDevMode || order.status === 'cancelled'}
                              />
                              {readyStockNote && (
                                <span className="block text-xs text-gray-700 mt-1">{readyStockNote}</span>
                              )}
                              {!isDevMode && !refunds.isFullyRefunded && (
                                <ItemRefundButton
                                  orderId={order.id}
                                  itemId={item.id}
                                  points={item.total_points}
                                  canReturnStock={
                                    unitsOffShelf > 0 && typeof variantInventory === 'number'
                                  }
                                />
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-700">No items found</p>
          )}
        </CardContent>
      </Card>

      {order.status !== 'cancelled' && activeItems.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Customer Notifications</h2>
          </CardHeader>
          <CardContent>
            {/* Its ready ticks are worked out from the line statuses when it mounts */}
            <PickupNoticeSender
              key={activeItems.map((item) => `${item.id}:${item.fulfillment_status}`).join(',')}
              orderId={order.id}
              lines={activeItems.map((item) => ({
                id: item.id,
                productName: item.product_name,
                variantLabel: orderItemVariantLabel(item),
                quantity: item.quantity,
                unitsToMake: unitsToMake(item),
                fulfillmentStatus: item.fulfillment_status ?? 'pending',
              }))}
              isDevMode={isDevMode}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
