import { createClient } from '@/lib/supabase/server';
import { Card, CardHeader, CardContent } from 'core/components/Card';
import { BackButton } from 'core/components/BackButton';
import { notFound } from 'next/navigation';
import { OrderStatusEditor } from './OrderStatusEditor';
import { OrderActions } from './OrderActions';
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
  
  const supabase = await createClient();

  // Run queries in parallel for faster loading
  const [orderResult, itemsResult, refundCheck] = await Promise.all([
    supabase
      .from('orders')
      .select('*, profiles(email, full_name)')
      .eq('id', id)
      .single(),
    supabase
      .from('order_items')
      .select('*')
      .eq('order_id', id),
    supabase
      .from('points_ledger')
      .select('id')
      .eq('order_id', id)
      .gt('delta_points', 0),
  ]);

  if (!orderResult.data) {
    notFound();
  }

  const order = orderResult.data;
  const items = itemsResult.data || [];
  const isAlreadyRefunded = (refundCheck.data?.length ?? 0) > 0;

  return (
    <div className="px-4 py-6 sm:px-0">
      <BackButton href="/admin/orders" label="Back to Orders" className="mb-4" />
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-8">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Order #{order.id.slice(0, 8).toUpperCase()}
          </h1>
          <p className="text-gray-700">
            Placed on {new Date(order.created_at).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-col gap-4 items-stretch sm:items-end w-full sm:w-auto">
          <OrderStatusEditor
            orderId={order.id}
            currentStatus={order.status}
            currentTrackingNumber={order.tracking_number}
            currentNotes={order.notes}
            isDevMode={isDevMode}
          />
          <OrderActions
            orderId={order.id}
            isDevMode={isDevMode}
            isAlreadyRefunded={isAlreadyRefunded}
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
                <p className="text-sm text-gray-700 font-medium">Email</p>
                <p className="font-medium text-gray-900 mt-1">{(order as any).profiles?.email || 'N/A'}</p>
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
                <p className="text-sm text-gray-700 font-medium">Delivery Method</p>
                <span
                  className={`inline-block mt-1 px-3 py-1 rounded-full text-sm font-medium ${
                    order.delivery_method === 'pickup'
                      ? 'bg-blue-100 text-blue-900'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  {order.delivery_method === 'pickup' ? 'Pickup' : 'Delivery'}
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-700 font-medium">Current Status</p>
                <span
                  className={`inline-block mt-1 px-3 py-1 rounded-full text-sm font-medium ${
                    order.status === 'delivered'
                      ? 'bg-green-100 text-green-900'
                      : order.status === 'shipped'
                      ? 'bg-purple-100 text-purple-900'
                      : order.status === 'processing'
                      ? 'bg-blue-100 text-blue-900'
                      : 'bg-yellow-100 text-yellow-900'
                  }`}
                >
                  {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </span>
              </div>
              {order.tracking_number && (
                <div>
                  <p className="text-sm text-gray-700 font-medium">Tracking Number</p>
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
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {order.delivery_method === 'delivery' && (
        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Shipping Address</h2>
          </CardHeader>
          <CardContent>
            {order.ship_name ? (
              <>
                <p className="font-medium text-gray-900">{order.ship_name}</p>
                <p className="text-sm text-gray-800 mt-1">{order.ship_address_line1}</p>
                {order.ship_address_line2 && (
                  <p className="text-sm text-gray-800">{order.ship_address_line2}</p>
                )}
                <p className="text-sm text-gray-800">
                  {order.ship_city}, {order.ship_state} {order.ship_zip}
                </p>
                <p className="text-sm text-gray-800">{order.ship_country}</p>
              </>
            ) : (
              <p className="text-gray-600">No shipping address provided</p>
            )}
          </CardContent>
        </Card>
      )}

      {order.delivery_method === 'pickup' && (
        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Pickup Information</h2>
          </CardHeader>
          <CardContent>
            <p className="text-gray-800">This order will be picked up at our location.</p>
            <p className="text-sm text-gray-600 mt-2">Customer will be notified when the order is ready for pickup.</p>
          </CardContent>
        </Card>
      )}

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
                      Variant
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.product_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-800">{item.variant_name || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{item.quantity}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{item.points_per_item}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">{item.total_points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-700">No items found</p>
          )}
        </CardContent>
      </Card>

      {order.notes && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Internal Notes</h2>
          </CardHeader>
          <CardContent>
            <p className="text-gray-800">{order.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
