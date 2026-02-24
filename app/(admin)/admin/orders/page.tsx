import { createClient } from '@/lib/supabase/server';
import { Card, CardHeader, CardContent } from 'core/components/Card';
import { Button } from 'core/components/Button';
import { ClickableTableRow } from './ClickableTableRow';
import { OrderPeriodFilter } from './OrderPeriodFilter';
import { OrderListActions } from './OrderListActions';
import { OrderActionsCell } from './OrderActionsCell';
import Link from 'next/link';

const ITEMS_PER_PAGE = 50;

interface AdminOrdersPageProps {
  searchParams: Promise<{ page?: string; days?: string }>;
}

export default async function AdminOrdersPage({ searchParams }: AdminOrdersPageProps) {
  const params = await searchParams;
  const currentPage = parseInt(params.page || '1', 10);
  const daysFilter = parseInt(params.days || '9999', 10); // Default all time, paginated

  // Check if using placeholder Supabase (dev mode)
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');

  let orders: any[] = [];
  let totalCount = 0;
  let stats = { new: 0, completed: 0, pending: 0 };

  if (!isDevMode) {
    const supabase = await createClient();

    const dateFilter =
      daysFilter === 9999
        ? null
        : (() => {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - daysFilter);
            return cutoff.toISOString();
          })();

    // Stats: count new/pending/completed across all orders (for the cards)
    const [statsNew, statsPending, statsCompleted, countResult, dataResult] = await Promise.all([
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'new'),
      supabase.from('orders').select('id', { count: 'exact', head: true }).in('status', ['new', 'processing']),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'delivered'),
      (() => {
        let q = supabase.from('orders').select('id', { count: 'exact', head: true });
        if (dateFilter) q = q.gte('created_at', dateFilter);
        return q;
      })(),
      (() => {
        let q = supabase
          .from('orders')
          .select('*, profiles(email)')
          .order('created_at', { ascending: false })
          .range((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE - 1);
        if (dateFilter) q = q.gte('created_at', dateFilter);
        return q;
      })(),
    ]);

    stats = {
      new: statsNew.count ?? 0,
      pending: statsPending.count ?? 0,
      completed: statsCompleted.count ?? 0,
    };
    totalCount = countResult.count ?? 0;
    orders = dataResult.data ?? [];
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));
  const hasMore = totalCount > currentPage * ITEMS_PER_PAGE;
  const from = totalCount === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const to = Math.min(currentPage * ITEMS_PER_PAGE, totalCount);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
        <p className="text-gray-600 mt-1">Manage and fulfill customer orders</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="py-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1 font-medium">New Orders</p>
                <p className="text-3xl font-bold text-gray-900">{stats.new}</p>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1 font-medium">Pending Orders</p>
                <p className="text-3xl font-bold text-gray-900">{stats.pending}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1 font-medium">Completed Orders</p>
                <p className="text-3xl font-bold text-gray-900">{stats.completed}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-lg font-semibold text-gray-900">Orders</h2>
            <OrderPeriodFilter currentDays={daysFilter} />
          </div>
          {!isDevMode && totalCount > 0 && (
            <p className="text-sm text-gray-600 mt-1">
              Showing {from}–{to} of {totalCount.toLocaleString()} orders
            </p>
          )}
        </CardHeader>
        <CardContent>
          {orders && orders.length > 0 ? (
            <>
            {/* Mobile card layout - hidden on md+ */}
            <div className="md:hidden space-y-4">
              {orders.map((order: any) => (
                <Link key={order.id} href={`/admin/orders/${order.id}`} className="block">
                  <Card className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <span className="text-primary font-semibold font-mono text-sm">
                          #{order.id.slice(0, 8).toUpperCase()}
                        </span>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium shrink-0 ${
                            order.status === 'delivered'
                              ? 'bg-green-100 text-green-900'
                              : order.status === 'shipped'
                              ? 'bg-purple-100 text-purple-900'
                              : order.status === 'processing'
                              ? 'bg-blue-100 text-blue-900'
                              : 'bg-yellow-100 text-yellow-900'
                          }`}
                        >
                          {order.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-900 truncate">{order.profiles?.email || 'N/A'}</p>
                      <div className="flex flex-wrap gap-x-2 gap-y-1 mt-2 text-sm text-gray-600">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            order.delivery_method === 'pickup'
                              ? 'bg-blue-100 text-blue-900'
                              : 'bg-gray-100 text-gray-900'
                          }`}
                        >
                          {order.delivery_method === 'pickup' ? 'Pickup' : 'Delivery'}
                        </span>
                        <span className="text-gray-500">
                          {order.delivery_method === 'pickup' ? '—' : (order.ship_name || 'N/A')}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
                        <span className="text-sm font-semibold text-gray-900">{order.total_points} pts</span>
                        <span className="text-sm text-gray-600">{new Date(order.created_at).toLocaleDateString()}</span>
                        <OrderActionsCell>
                          <OrderListActions orderId={order.id} isDevMode={isDevMode} />
                        </OrderActionsCell>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>

            {/* Desktop table - hidden on mobile */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                      Order ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                      Delivery Method
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                      Ship To
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                      Points
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {orders.map((order: any) => (
                    <ClickableTableRow key={order.id} href={`/admin/orders/${order.id}`}>
                      <td className="px-4 py-3 text-sm font-mono text-gray-900">
                        <span className="text-primary font-semibold">
                          {order.id.slice(0, 8)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{order.profiles?.email || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            order.delivery_method === 'pickup'
                              ? 'bg-blue-100 text-blue-900'
                              : 'bg-gray-100 text-gray-900'
                          }`}
                        >
                          {order.delivery_method === 'pickup' ? 'Pickup' : 'Delivery'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {order.delivery_method === 'pickup' ? (
                          <span className="text-gray-500 italic">N/A</span>
                        ) : (
                          order.ship_name || 'N/A'
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">{order.total_points}</td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            order.status === 'delivered'
                              ? 'bg-green-100 text-green-900'
                              : order.status === 'shipped'
                              ? 'bg-purple-100 text-purple-900'
                              : order.status === 'processing'
                              ? 'bg-blue-100 text-blue-900'
                              : 'bg-yellow-100 text-yellow-900'
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {new Date(order.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <OrderActionsCell>
                          <OrderListActions orderId={order.id} isDevMode={isDevMode} />
                        </OrderActionsCell>
                      </td>
                    </ClickableTableRow>
                  ))}
                </tbody>
              </table>
            </div>
            {!isDevMode && totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2 flex-wrap">
                {currentPage > 1 && (
                  <Link href={`/admin/orders?days=${daysFilter}&page=${currentPage - 1}`}>
                    <Button variant="outline" size="sm">
                      Previous
                    </Button>
                  </Link>
                )}
                <span className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>
                {hasMore && (
                  <Link href={`/admin/orders?days=${daysFilter}&page=${currentPage + 1}`}>
                    <Button variant="outline" size="sm">
                      Next
                    </Button>
                  </Link>
                )}
              </div>
            )}
            </>
          ) : (
            <p className="text-gray-700 text-center py-8">
              {isDevMode ? 'Configure Supabase to see real data' : 'No orders found'}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

