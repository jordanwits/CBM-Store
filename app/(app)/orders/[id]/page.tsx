import { createClient } from '@/lib/supabase/server';
import { getJwtSubject } from '@/lib/auth/jwt';
import { Card, CardHeader, CardContent } from 'core/components/Card';
import { PageHeader } from 'core/components/PageHeader';
import { Badge } from 'core/components/Badge';
import { BackButton } from 'core/components/BackButton';
import { Button } from 'core/components/Button';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { PrintOrderButton, ContactSupportButton } from './OrderActions';
import { getTrackingUrl } from '@/lib/tracking';

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  
  // Check if using placeholder Supabase (dev mode)
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  
  let order: any = null;
  let items: any[] = [];
  
  if (isDevMode) {
    // Mock data for dev mode
    order = {
      id: 'mock-order-1',
      total_points: 10000,
      status: 'processing',
      delivery_method: 'delivery', // 'pickup' or 'delivery'
      created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
      ship_name: 'Demo User',
      ship_address_line1: '123 Main St',
      ship_address_line2: 'Apt 4',
      ship_city: 'Springfield',
      ship_state: 'IL',
      ship_zip: '62701',
      ship_country: 'United States',
      notes: null,
    };
    items = [
      {
        id: 'item-1',
        product_id: '1',
        product_name: 'Company Logo T-Shirt',
        product_image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop&q=80',
        variant_name: 'Large',
        quantity: 2,
        points_per_item: 2500,
        total_points: 5000,
      },
      {
        id: 'item-2',
        product_id: '2',
        product_name: 'Insulated Water Bottle',
        product_image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400&h=400&fit=crop&q=80',
        variant_name: null,
        quantity: 1,
        points_per_item: 3500,
        total_points: 3500,
      },
      {
        id: 'item-3',
        product_id: '5',
        product_name: 'Coffee Mug',
        product_image: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400&h=400&fit=crop&q=80',
        variant_name: null,
        quantity: 1,
        points_per_item: 1500,
        total_points: 1500,
      },
    ];
  } else {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.access_token ? getJwtSubject(session.access_token) : null;

    if (!userId) return null;

    // Run both queries in parallel for faster loading
    const [orderResult, itemsResult] = await Promise.all([
      supabase
        .from('orders')
        .select('id, user_id, status, total_points, delivery_method, ship_name, ship_address_line1, ship_address_line2, ship_city, ship_state, ship_zip, ship_country, tracking_number, notes, created_at')
        .eq('id', id)
        .eq('user_id', userId)
        .single(),
      supabase
        .from('order_items')
        .select('id, order_id, product_id, product_name, product_image, variant_name, quantity, points_per_item, total_points')
        .eq('order_id', id),
    ]);

    if (!orderResult.data) {
      notFound();
    }
    
    order = orderResult.data;
    items = itemsResult.data || [];
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'ready': return 'info';
      case 'processing': return 'warning';
      case 'pending': return 'default';
      default: return 'default';
    }
  };

  return (
    <div>
      {/* Back Button and Breadcrumb */}
      <div className="mb-6 space-y-3">
        <BackButton href="/orders" label="Back to Orders" />
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/orders" className="text-gray-600 hover:text-gray-900 font-medium">
            Orders
          </Link>
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-gray-900 font-medium">#{order.id.slice(0, 8).toUpperCase()}</span>
        </nav>
      </div>

      {/* Header with Actions */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Order #{order.id.slice(0, 8).toUpperCase()}
          </h1>
          <p className="text-gray-600">
            Placed on {new Date(order.created_at).toLocaleDateString('en-US', { 
              month: 'long', 
              day: 'numeric', 
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Badge variant={getStatusVariant(order.status)} size="lg" className="px-4 py-2">
            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          </Badge>
          <PrintOrderButton />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Order Summary Card */}
        <Card className="lg:col-span-2">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b">
            <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Order Summary
            </h2>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-2">Order Total</p>
                <p className="text-4xl font-bold text-primary">
                  {order.total_points.toLocaleString()}
                </p>
                <p className="text-sm text-gray-600 mt-1">points</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 mb-2">Total Items</p>
                <p className="text-4xl font-bold text-gray-900">
                  {items.reduce((sum, item) => sum + item.quantity, 0)}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  {items.length} {items.length === 1 ? 'product' : 'products'}
                </p>
              </div>
            </div>

            <div className="pt-6 border-t">
              <p className="text-sm font-medium text-gray-500 mb-3">Delivery Method</p>
              <div className="flex items-center gap-3">
                {order.delivery_method === 'delivery' ? (
                  <>
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Delivery</p>
                      <p className="text-sm text-gray-600">Will be processed and shipped to your address</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Pickup</p>
                      <p className="text-sm text-gray-600">You will pick up at our location</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {order.tracking_number && (
              <div className="pt-6 border-t">
                <p className="text-sm font-medium text-gray-500 mb-2">Tracking Number</p>
                <Link 
                  href={getTrackingUrl(order.tracking_number)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium font-mono text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-2"
                >
                  {order.tracking_number}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </Link>
                <p className="text-xs text-gray-500 mt-1">Click to track your package</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Shipping Address Card - Only show for delivery */}
        {order.delivery_method === 'delivery' && order.ship_name && (
          <Card>
            <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b">
              <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Shipping Address
              </h2>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                <p className="font-semibold text-gray-900 text-base">{order.ship_name}</p>
                <p className="text-sm text-gray-700">{order.ship_address_line1}</p>
                {order.ship_address_line2 && (
                  <p className="text-sm text-gray-700">{order.ship_address_line2}</p>
                )}
                <p className="text-sm text-gray-700">
                  {order.ship_city}, {order.ship_state} {order.ship_zip}
                </p>
                <p className="text-sm text-gray-700 font-medium">{order.ship_country}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pickup Information Card - Only show for pickup */}
        {order.delivery_method === 'pickup' && (
          <Card>
            <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b">
              <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Pickup Information
              </h2>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                <p className="text-gray-800">Your order will be available for pickup at our location.</p>
                <p className="text-sm text-gray-600 mt-2">You will be notified when your order is ready for pickup.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Order Items */}
      <Card>
        <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b">
          <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900">
            <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            Order Items
            <Badge variant="default" className="ml-2">
              {items.reduce((sum, item) => sum + item.quantity, 0)} items
            </Badge>
          </h2>
        </CardHeader>
        <CardContent>
          {items && items.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {items.map((item) => (
                <div key={item.id} className="flex gap-4 py-6 first:pt-0 last:pb-0 hover:bg-gray-50 -mx-6 px-6 transition-colors">
                  {/* Product Image */}
                  <Link 
                    href={`/product/${item.product_id}`}
                    className="flex-shrink-0 w-24 h-24 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg overflow-hidden relative group"
                  >
                    {item.product_image ? (
                      <Image
                        src={item.product_image}
                        alt={item.product_name}
                        fill
                        className="object-cover object-[center_30%] group-hover:scale-110 transition-transform duration-200"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </Link>

                  {/* Product Details */}
                  <div className="flex-1 min-w-0">
                    <Link 
                      href={`/product/${item.product_id}`}
                      className="block group"
                    >
                      <h3 className="font-semibold text-gray-900 text-lg mb-2 group-hover:text-primary transition-colors">
                        {item.product_name}
                      </h3>
                    </Link>
                    <div className="space-y-1">
                      {item.variant_name && (
                        <p className="text-sm text-gray-600 flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                          </svg>
                          <span><strong>Option:</strong> {item.variant_name}</span>
                        </p>
                      )}
                      <p className="text-sm text-gray-600 flex items-center gap-2">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                        </svg>
                        <span><strong>Quantity:</strong> {item.quantity}</span>
                      </p>
                      <p className="text-sm text-gray-600 flex items-center gap-2">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span><strong>Unit Price:</strong> {item.points_per_item.toLocaleString()} pts</span>
                      </p>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-2xl font-bold text-gray-900">
                      {item.total_points.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">points</p>
                  </div>
                </div>
              ))}
              
              {/* Total */}
              <div className="pt-6 mt-6 border-t-2 border-gray-300">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-lg font-semibold text-gray-900">Order Total</p>
                    <p className="text-sm text-gray-500">
                      {items.reduce((sum, item) => sum + item.quantity, 0)} total items
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-4xl font-bold text-primary">
                      {order.total_points.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">points redeemed</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No items found</p>
          )}
        </CardContent>
      </Card>

      {/* Order Notes */}
      {order.notes && (
        <Card className="mt-6">
          <CardHeader className="bg-gradient-to-r from-yellow-50 to-yellow-100 border-b">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-900">
              <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              Order Notes
            </h2>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 leading-relaxed">{order.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Help Section */}
      <Card className="mt-6 bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-primary/20">
        <CardContent className="py-8">
          <div className="text-center max-w-2xl mx-auto">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-full mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Need Help with Your Order?</h3>
            <p className="text-gray-600 mb-6">
              Our support team is here to assist you with any questions about your order, shipping, or tracking information.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <ContactSupportButton />
              <Link href="/orders">
                <Button variant="outline" size="lg">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to All Orders
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
