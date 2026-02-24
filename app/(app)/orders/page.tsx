import { createClient } from '@/lib/supabase/server';
import { getJwtSubject } from '@/lib/auth/jwt';
import { Card, CardContent } from 'core/components/Card';
import { PageHeader } from 'core/components/PageHeader';
import { Badge } from 'core/components/Badge';
import { EmptyState } from 'core/components/EmptyState';
import { Button } from 'core/components/Button';
import Link from 'next/link';
import { OrdersPeriodFilter } from './OrdersPeriodFilter';

// Cache orders list for 2 minutes (orders are user-specific and update frequently)
export const revalidate = 120;

interface OrdersPageProps {
  searchParams: Promise<{
    days?: string;
    page?: string;
  }>;
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const params = await searchParams;
  const daysFilter = parseInt(params.days || '90', 10); // Default to last 90 days
  const currentPage = parseInt(params.page || '1', 10);
  const itemsPerPage = 20;
  
  // Check if using placeholder Supabase (dev mode)
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  
  let orders: any[] = [];
  let totalCount = 0;
  let hasMore = false;
  
  if (isDevMode) {
    // Mock data for dev mode
    orders = [
      {
        id: 'mock-order-1',
        total_points: 10000,
        status: 'processing',
        delivery_method: 'delivery',
        created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
        ship_name: 'Demo User',
      },
      {
        id: 'mock-order-2',
        total_points: 2500,
        status: 'new',
        delivery_method: 'pickup',
        created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
        ship_name: null,
      },
      {
        id: 'mock-order-3',
        total_points: 1500,
        status: 'shipped',
        delivery_method: 'delivery',
        created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
        ship_name: 'Demo User',
      },
    ];
    totalCount = 3;
  } else {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.access_token ? getJwtSubject(session.access_token) : null;

    if (!userId) return null;

    // Calculate date cutoff
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysFilter);
    const cutoffISO = cutoffDate.toISOString();
    
    // Run count and data queries in parallel for faster loading
    const [countResult, dataResult] = await Promise.all([
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', cutoffISO),
      supabase
        .from('orders')
        .select('id, total_points, status, delivery_method, created_at, ship_name')
        .eq('user_id', userId)
        .gte('created_at', cutoffISO)
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1),
    ]);
    
    totalCount = countResult.count || 0;
    hasMore = totalCount > currentPage * itemsPerPage;
    orders = dataResult.data || [];
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'delivered': return 'success';
      case 'shipped': return 'info';
      case 'processing': return 'warning';
      case 'new': return 'default';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  return (
    <div className="pb-8">
      <PageHeader 
        title="My Orders" 
        subtitle={totalCount > 0 ? `${totalCount} ${totalCount === 1 ? 'order' : 'orders'} in last ${daysFilter} days` : 'Track your redemptions'}
      />

      {/* Date filter controls */}
      <div className="mb-6">
        <OrdersPeriodFilter currentDays={daysFilter} />
      </div>

      {orders && orders.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-4">
            {orders.map((order) => (
            <Link key={order.id} href={`/orders/${order.id}`}>
              <Card className="group hover:shadow-xl transition-all duration-200 cursor-pointer border-2 border-transparent hover:border-secondary/40">
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge variant={getStatusVariant(order.status)}>
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </Badge>
                        <span className="text-sm text-gray-500">
                          Order #{order.id.slice(0, 8).toUpperCase()}
                        </span>
                      </div>
                      
                      <p className="text-2xl font-bold text-secondary mb-2">
                        {order.total_points.toLocaleString()} <span className="text-base font-normal text-gray-600">points</span>
                      </p>
                      
                      <div className="space-y-1 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Placed {new Date(order.created_at).toLocaleDateString('en-US', { 
                            month: 'long', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })}
                        </div>
                        <div className="flex items-center gap-2">
                          {order.delivery_method === 'delivery' ? (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                              </svg>
                              <span>Shipping to: {order.ship_name}</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <span>Pickup</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-primary font-medium group-hover:gap-3 transition-all">
                      <span>View Details</span>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            {currentPage > 1 && (
              <Link href={`/orders?days=${daysFilter}&page=${currentPage - 1}`}>
                <Button variant="outline" size="sm">
                  Previous
                </Button>
              </Link>
            )}
            <span className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </span>
            {hasMore && (
              <Link href={`/orders?days=${daysFilter}&page=${currentPage + 1}`}>
                <Button variant="outline" size="sm">
                  Next
                </Button>
              </Link>
            )}
          </div>
        )}
      </>
      ) : (
        <Card>
          <CardContent>
            <EmptyState
              icon={
                <svg className="w-20 h-20 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              }
              title="No orders yet"
              description="Start shopping and redeem your points for exclusive merchandise"
              action={
                <Link href="/dashboard">
                  <Button variant="primary" size="lg">
                    Browse Shop
                  </Button>
                </Link>
              }
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

