import { createClient } from '@/lib/supabase/server';
import { Card, CardHeader, CardContent } from 'core/components/Card';
import { Button } from 'core/components/Button';
import Link from 'next/link';

export default async function AdminReportsPage() {
  // Check if using placeholder Supabase (dev mode)
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  
  let totalIssued = 0;
  let totalRedeemed = 0;
  let sortedProducts: [string, number][] = [];
  let averageOrderValue = 0;
  let activeUsersCount = 0;
  
  if (!isDevMode) {
    const supabase = await createClient();

    // Run all report queries in parallel for faster loading
    const [pointsIssuedResult, pointsRedeemedResult, topProductsResult, ordersResult, usersResult] = await Promise.all([
      supabase.from('points_ledger').select('delta_points').gt('delta_points', 0),
      supabase.from('points_ledger').select('delta_points').lt('delta_points', 0),
      supabase.from('order_items').select('product_name, quantity'),
      supabase.from('orders').select('total_points'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
    ]);

    totalIssued = pointsIssuedResult.data?.reduce((sum, entry) => sum + entry.delta_points, 0) || 0;
    totalRedeemed = Math.abs(pointsRedeemedResult.data?.reduce((sum, entry) => sum + entry.delta_points, 0) || 0);
    const topProducts = topProductsResult.data;
    const orders = ordersResult.data || [];
    activeUsersCount = usersResult.count || 0;

    // Calculate average order value
    if (orders.length > 0) {
      const totalOrderValue = orders.reduce((sum, order) => sum + order.total_points, 0);
      averageOrderValue = Math.round(totalOrderValue / orders.length);
    }

    // Aggregate by product name - sum quantities instead of points
    const productSummary: Record<string, number> = {};
    topProducts?.forEach((item) => {
      productSummary[item.product_name] = (productSummary[item.product_name] || 0) + item.quantity;
    });

    sortedProducts = Object.entries(productSummary)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
  } else {
    // Mock data for dev mode
    totalIssued = 5000;
    totalRedeemed = 1500;
    sortedProducts = [
      ['Company Logo T-Shirt', 45],
      ['Insulated Water Bottle', 32],
      ['Laptop Backpack', 18],
    ];
    averageOrderValue = 750;
    activeUsersCount = 42;
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600 mt-1">Analytics and insights for your store</p>
        </div>
        <Link href="/admin/exports" className="shrink-0">
          <Button variant="primary">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export Data
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="py-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1 font-medium">Points Issued</p>
                <p className="text-3xl font-bold text-gray-900">{totalIssued.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1 font-medium">Points Redeemed</p>
                <p className="text-3xl font-bold text-gray-900">{totalRedeemed.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1 font-medium">Redemption Rate</p>
                <p className="text-3xl font-bold text-gray-900">
                  {totalIssued > 0 ? Math.round((totalRedeemed / totalIssued) * 100) : 0}%
                </p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Most Purchased Products</h2>
          </CardHeader>
          <CardContent>
            {sortedProducts.length > 0 ? (
              <div className="space-y-3">
                {sortedProducts.map(([name, quantity], index) => (
                  <div key={name} className="flex justify-between items-center py-2 border-b last:border-0">
                    <div className="flex items-center">
                      <span className="text-lg font-semibold text-gray-600 mr-3">{index + 1}</span>
                      <span className="text-sm font-medium text-gray-900">{name}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{quantity} purchased</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                {isDevMode ? 'Mock data shown (configure Supabase to see real data)' : 'No purchases yet'}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Quick Stats</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between py-2 border-b">
                <span className="text-sm text-gray-600">Outstanding Points</span>
                <span className="text-sm font-semibold text-gray-900">
                  {(totalIssued - totalRedeemed).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-sm text-gray-600">Average Order Value</span>
                <span className="text-sm font-semibold text-gray-900">{averageOrderValue.toLocaleString()} pts</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-sm text-gray-600">Active Users</span>
                <span className="text-sm font-semibold text-gray-900">{activeUsersCount.toLocaleString()}</span>
              </div>
            </div>
            {isDevMode && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-gray-500 text-center">
                  Note: Showing mock data. Configure Supabase to see real analytics.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

