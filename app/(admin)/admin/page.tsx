import { createClient } from '@/lib/supabase/server';
import { Card, CardHeader, CardContent } from 'core/components/Card';
import Link from 'next/link';

export default async function AdminDashboardPage() {
  // Check if using placeholder Supabase (dev mode)
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  
  let usersCount = 0;
  let productsCount = 0;
  let ordersCount = 0;
  let recentOrders: any[] = [];
  
  if (!isDevMode) {
    const supabase = await createClient();

    // Run all dashboard queries in parallel for faster loading
    const [usersResult, productsResult, ordersResult, recentOrdersResult] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('products').select('*', { count: 'exact', head: true }).eq('active', true),
      supabase.from('orders').select('*', { count: 'exact', head: true }),
      supabase.from('orders').select('*, profiles(email)').order('created_at', { ascending: false }).limit(5),
    ]);

    usersCount = usersResult.count || 0;
    productsCount = productsResult.count || 0;
    ordersCount = ordersResult.count || 0;
    recentOrders = recentOrdersResult.data || [];
  } else {
    // Mock data for dev mode
    usersCount = 3;
    productsCount = 5;
    ordersCount = 2;
    recentOrders = [];
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Overview of your store's key metrics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        <Link href="/admin/users" className="block">
          <Card className="hover:shadow-lg hover:border-primary transition-all cursor-pointer h-full border-l-4 border-l-primary">
            <CardContent className="py-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1 font-medium">Total Users</p>
                  <p className="text-3xl font-bold text-primary">{usersCount || 0}</p>
                </div>
                <div className="p-3 bg-primary/10 rounded-lg">
                  <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/products" className="block">
          <Card className="hover:shadow-lg hover:border-secondary transition-all cursor-pointer h-full border-l-4 border-l-secondary">
            <CardContent className="py-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1 font-medium">Active Products</p>
                  <p className="text-3xl font-bold text-secondary">{productsCount || 0}</p>
                </div>
                <div className="p-3 bg-secondary/10 rounded-lg">
                  <svg className="w-6 h-6 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/orders" className="block">
          <Card className="hover:shadow-lg hover:border-primary transition-all cursor-pointer h-full border-l-4 border-l-primary">
            <CardContent className="py-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1 font-medium">Total Orders</p>
                  <p className="text-3xl font-bold text-primary">{ordersCount || 0}</p>
                </div>
                <div className="p-3 bg-primary/10 rounded-lg">
                  <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/reports" className="block">
          <Card className="hover:shadow-lg hover:border-secondary transition-all cursor-pointer h-full border-l-4 border-l-secondary">
            <CardContent className="py-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1 font-medium">Reports</p>
                  <p className="text-lg font-semibold text-secondary">View Analytics →</p>
                </div>
                <div className="p-3 bg-secondary/10 rounded-lg">
                  <svg className="w-6 h-6 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recent Orders</h2>
            <Link href="/admin/orders" className="text-sm font-medium text-primary hover:underline underline-offset-2">
              View all
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recentOrders && recentOrders.length > 0 ? (
            <>
            {/* Mobile card layout - hidden on md+ */}
            <div className="md:hidden space-y-3">
              {recentOrders.map((order: any) => (
                <Link key={order.id} href={`/admin/orders/${order.id}`} className="block">
                  <div className="p-4 rounded-lg border border-gray-200 hover:border-primary/40 hover:bg-gray-50/50 transition-colors">
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
                    <p className="text-sm text-gray-900 truncate mb-1">{order.profiles?.email || 'N/A'}</p>
                    <div className="flex flex-wrap gap-2 text-sm">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          order.delivery_method === 'pickup'
                            ? 'bg-blue-100 text-blue-900'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        {order.delivery_method === 'pickup' ? 'Pickup' : 'Delivery'}
                      </span>
                      <span className="font-semibold text-gray-900">{order.total_points} pts</span>
                      <span className="text-gray-500">{new Date(order.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
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
                      Points
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {recentOrders.map((order: any) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="text-primary hover:underline font-mono font-semibold"
                        >
                          {order.id.slice(0, 8)}
                        </Link>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          ) : (
            <p className="text-gray-700 text-center py-8">
              {isDevMode ? 'Configure Supabase to see real data' : 'No orders yet'}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

