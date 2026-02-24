import { createClient } from '@/lib/supabase/server';
import { Card, CardHeader, CardContent } from 'core/components/Card';
import { Button } from 'core/components/Button';
import { Badge } from 'core/components/Badge';
import { PageHeader } from 'core/components/PageHeader';
import Link from 'next/link';
import PointsAdjustmentForm from './PointsAdjustmentForm';
import { BulkPointsUpload } from './BulkPointsUpload';
import { AdminHistoryFilters } from './AdminHistoryFilters';
import { AdminRecentTransactionsCard } from './AdminRecentTransactionsCard';
import { FilterDrawer } from 'core/components/FilterDrawer';

interface AdminPointsPageProps {
  searchParams: Promise<{
    days?: string;
    page?: string;
    startDate?: string;
    endDate?: string;
    type?: string;
    minPoints?: string;
    maxPoints?: string;
    reason?: string;
    userEmail?: string;
  }>;
}

export default async function AdminPointsPage({ searchParams }: AdminPointsPageProps) {
  const params = await searchParams;
  // Default to all time for extended history view if no filters are set
  const hasAnyFilter = params.days || params.startDate || params.endDate || params.type || params.minPoints || params.maxPoints || params.reason || params.userEmail;
  const daysFilter = params.days ? parseInt(params.days, 10) : (hasAnyFilter ? null : 9999);
  const currentPage = parseInt(params.page || '1', 10);
  const itemsPerPage = 50;
  
  // Extract filter parameters
  const startDate = params.startDate || null;
  const endDate = params.endDate || null;
  const type = (params.type as 'all' | 'earned' | 'spent') || 'all';
  const minPoints = params.minPoints ? parseInt(params.minPoints, 10) : null;
  const maxPoints = params.maxPoints ? parseInt(params.maxPoints, 10) : null;
  const reason = params.reason || null;
  const userEmail = params.userEmail || null;
  
  // Check if using placeholder Supabase (dev mode)
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  
  let transactions: any[] = [];
  let totalCount = 0;
  let hasMore = false;
  let totalEarned = 0;
  let totalSpent = 0;
  let uniqueUsers = 0;
  let averageTransactionValue = 0;
  
  if (!isDevMode) {
    const supabase = await createClient();

    // Get user IDs if filtering by email
    let userIds: string[] | null = null;
    if (userEmail) {
      const { data: matchingUsers } = await supabase
        .from('profiles')
        .select('id')
        .ilike('email', `%${userEmail}%`);
      
      if (matchingUsers && matchingUsers.length > 0) {
        userIds = matchingUsers.map(u => u.id);
      } else {
        // No matching users, return empty results
        userIds = [];
      }
    }

    // Helper function to build base query with all filters
    const buildFilteredQuery = (query: any) => {
      // User email filter - filter by user IDs
      if (userIds !== null) {
        if (userIds.length === 0) {
          // No matching users, return empty result by filtering to non-existent ID
          query = query.eq('user_id', '00000000-0000-0000-0000-000000000000');
        } else {
          query = query.in('user_id', userIds);
        }
      }
      
      // Date filtering: prioritize custom date range, then days filter
      if (startDate) {
        query = query.gte('created_at', new Date(startDate).toISOString());
      } else if (daysFilter !== null) {
        if (daysFilter === 9999) {
          // All time - no date filter
        } else {
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - daysFilter);
          query = query.gte('created_at', cutoffDate.toISOString());
        }
      }
      
      if (endDate) {
        // Include the entire end date by setting time to end of day
        const endDateObj = new Date(endDate);
        endDateObj.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endDateObj.toISOString());
      }
      
      // Transaction type filter
      if (type === 'earned') {
        query = query.gt('delta_points', 0);
      } else if (type === 'spent') {
        query = query.lt('delta_points', 0);
      }
      
      // Points range filter
      if (minPoints !== null) {
        query = query.gte('delta_points', minPoints);
      }
      if (maxPoints !== null) {
        query = query.lte('delta_points', maxPoints);
      }
      
      // Reason search filter (case-insensitive)
      if (reason) {
        query = query.ilike('reason', `%${reason}%`);
      }
      
      return query;
    };

    // Build queries for count, totals, unique users, and paginated history
    let baseQuery = supabase
      .from('points_ledger')
      .select('*');
    baseQuery = buildFilteredQuery(baseQuery);

    // Build count query
    let countQuery = supabase
      .from('points_ledger')
      .select('id', { count: 'exact', head: true });
    countQuery = buildFilteredQuery(countQuery);

    // Build unique users query
    let uniqueUsersQuery = supabase
      .from('points_ledger')
      .select('user_id', { count: 'exact', head: false });
    uniqueUsersQuery = buildFilteredQuery(uniqueUsersQuery);

    // Build paginated transactions query
    let transactionsQuery = supabase
      .from('points_ledger')
      .select('id, delta_points, reason, order_id, created_at, profiles!points_ledger_user_id_fkey(email)');
    transactionsQuery = buildFilteredQuery(transactionsQuery);
    
    transactionsQuery = transactionsQuery
      .order('created_at', { ascending: false })
      .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1);

    // Run queries in parallel
    const [countResult, totalsResult, uniqueUsersResult, transactionsResult] = await Promise.all([
      countQuery,
      baseQuery.select('delta_points'), // Get all delta_points for totals calculation
      uniqueUsersQuery,
      transactionsQuery,
    ]);

    totalCount = countResult.count || 0;
    hasMore = totalCount > currentPage * itemsPerPage;
    transactions = transactionsResult.data || [];

    // Calculate unique users
    const allUserIds = uniqueUsersResult.data || [];
    uniqueUsers = new Set(allUserIds.map((entry: any) => entry.user_id)).size;

    // Calculate totals and average transaction value for the filtered period
    const allDeltaPoints = totalsResult.data || [];
    totalEarned = allDeltaPoints
      .filter((entry: any) => entry.delta_points > 0)
      .reduce((sum: number, entry: any) => sum + entry.delta_points, 0) || 0;

    totalSpent = Math.abs(
      allDeltaPoints
        .filter((entry: any) => entry.delta_points < 0)
        .reduce((sum: number, entry: any) => sum + entry.delta_points, 0) || 0
    );

    // Calculate average transaction value (absolute value of delta_points)
    if (allDeltaPoints.length > 0) {
      const totalAbsolutePoints = allDeltaPoints.reduce(
        (sum: number, entry: any) => sum + Math.abs(entry.delta_points),
        0
      );
      averageTransactionValue = Math.round(totalAbsolutePoints / allDeltaPoints.length);
    }
  } else {
    // Mock data for dev mode
    transactions = [
      {
        id: '1',
        delta_points: 1000,
        reason: 'Welcome bonus',
        created_at: new Date().toISOString(),
        profiles: { email: 'demo@cbmplastics.com' },
      },
      {
        id: '2',
        delta_points: -500,
        reason: 'Order redemption',
        order_id: 'mock-order-1',
        created_at: new Date(Date.now() - 86400000).toISOString(),
        profiles: { email: 'demo@cbmplastics.com' },
      },
    ];
    totalCount = 2;
    totalEarned = 1000;
    totalSpent = 500;
    uniqueUsers = 1;
    averageTransactionValue = 750;
  }

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const getFilterLabel = () => {
    if (startDate && endDate) {
      return `Custom range`;
    }
    if (startDate) {
      return `From ${new Date(startDate).toLocaleDateString()}`;
    }
    if (daysFilter === null) {
      if (type !== 'all' || minPoints !== null || maxPoints !== null || reason || userEmail) {
        return 'All time (filtered)';
      }
      return 'All time';
    }
    if (daysFilter === 9999) return 'All time';
    if (daysFilter === 365) return 'Last year';
    if (daysFilter === 180) return 'Last 6 months';
    if (daysFilter === 90) return 'Last 90 days';
    if (daysFilter === 30) return 'Last 30 days';
    return `Last ${daysFilter} days`;
  };

  // Build pagination URL preserving all filters
  const buildPaginationUrl = (page: number) => {
    const urlParams = new URLSearchParams();
    if (daysFilter !== null) urlParams.set('days', daysFilter.toString());
    if (startDate) urlParams.set('startDate', startDate);
    if (endDate) urlParams.set('endDate', endDate);
    if (type !== 'all') urlParams.set('type', type);
    if (minPoints !== null) urlParams.set('minPoints', minPoints.toString());
    if (maxPoints !== null) urlParams.set('maxPoints', maxPoints.toString());
    if (reason) urlParams.set('reason', reason);
    if (userEmail) urlParams.set('userEmail', userEmail);
    urlParams.set('page', page.toString());
    return `/admin/points?${urlParams.toString()}`;
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-8">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-gray-900">Points</h1>
          <p className="text-gray-600 mt-1">Manage user points and transactions</p>
        </div>
        <div className="shrink-0">
          <BulkPointsUpload isDevMode={isDevMode} />
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Adjust User Points</h2>
        </CardHeader>
        <CardContent>
          <PointsAdjustmentForm isDevMode={isDevMode} />
        </CardContent>
      </Card>

      {/* Recent Transactions Card - Always shows last 30 days */}
      <div className="mb-8">
        <AdminRecentTransactionsCard isDevMode={isDevMode} />
      </div>

      {/* Extended History Section */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Left Sidebar - Filters (desktop) / Slide-in drawer (mobile) */}
        <FilterDrawer
          triggerLabel="Filters"
          hasActiveFilters={!!(startDate || endDate || type !== 'all' || minPoints || maxPoints || reason || userEmail)}
          wrapperClassName="lg:w-52"
        >
          <div className="sticky top-24 pt-4">
            <AdminHistoryFilters currentDays={daysFilter || undefined} />
          </div>
        </FilterDrawer>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="py-8">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-600 mb-3">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-600 mb-2">Total Transactions</p>
                  <p className="text-4xl font-bold text-gray-900">{totalCount.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-1">In filtered period</p>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="py-8">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-600 mb-3">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-600 mb-2">Total Redeemed</p>
                  <p className="text-4xl font-bold text-green-600">{totalSpent.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-1">Points redeemed</p>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="py-8">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-600 mb-3">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-600 mb-2">Avg Transaction</p>
                  <p className="text-4xl font-bold text-gray-900">{averageTransactionValue.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-1">Points per transaction</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Extended Transaction History */}
          <Card>
            <CardHeader className="bg-gray-50">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <h2 className="text-lg font-semibold text-gray-900">Transaction History</h2>
                <Badge variant="default" className="w-fit">{totalCount} {getFilterLabel()}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {transactions && transactions.length > 0 ? (
                <>
                  <div className="divide-y divide-gray-200">
                    {transactions.map((entry: any) => {
                      const hasOrderLink = !!entry.order_id;
                      return (
                        <div
                          key={entry.id}
                          className={`flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 py-4 first:pt-0 last:pb-0 ${hasOrderLink ? 'group cursor-pointer' : ''}`}
                        >
                          <div className="flex-1 min-w-0 flex gap-3">
                            {entry.delta_points > 0 ? (
                              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                                <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" transform="rotate(180 10 10)" />
                                </svg>
                              </div>
                            ) : (
                              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                                <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <p className="font-semibold text-gray-900 truncate">
                                {hasOrderLink ? (
                                  <Link href={`/admin/orders/${entry.order_id}`} className="group-hover:text-primary transition-colors">
                                    {entry.reason}
                                    <svg 
                                      className="w-4 h-4 text-blue-600 inline-block ml-2" 
                                      fill="none" 
                                      stroke="currentColor" 
                                      viewBox="0 0 24 24"
                                      aria-label="Linked to order"
                                    >
                                      <path 
                                        strokeLinecap="round" 
                                        strokeLinejoin="round" 
                                        strokeWidth={2} 
                                        d="M13 7l5 5m0 0l-5 5m5-5H6" 
                                      />
                                    </svg>
                                  </Link>
                                ) : (
                                  entry.reason
                                )}
                              </p>
                              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 mt-0.5 gap-0.5">
                                <p className="text-sm text-gray-500 truncate">
                                  {entry.profiles?.email || 'Unknown user'}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {new Date(entry.created_at).toLocaleDateString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric', 
                                    year: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit'
                                  })}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end sm:flex-col sm:items-end gap-2 sm:gap-0 sm:ml-4 sm:flex-shrink-0">
                            <p
                              className={`text-xl sm:text-2xl font-bold ${
                                entry.delta_points > 0 ? 'text-green-600' : 'text-red-600'
                              }`}
                            >
                              {entry.delta_points > 0 ? '+' : ''}
                              {entry.delta_points.toLocaleString()}
                            </p>
                            <p className="text-xs text-gray-500">points</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination controls */}
                  {totalPages > 1 && (
                    <div className="mt-6 flex items-center justify-center gap-2 pt-6 border-t">
                      {currentPage > 1 && (
                        <Link href={buildPaginationUrl(currentPage - 1)}>
                          <Button variant="outline" size="sm">
                            Previous
                          </Button>
                        </Link>
                      )}
                      <span className="text-sm text-gray-600">
                        Page {currentPage} of {totalPages}
                      </span>
                      {hasMore && (
                        <Link href={buildPaginationUrl(currentPage + 1)}>
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
                  {isDevMode ? 'Mock transactions shown (configure Supabase to see real data)' : 'No transactions found'}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

