import { createClient } from '@/lib/supabase/server';
import { getJwtSubject } from '@/lib/auth/jwt';
import { Card, CardHeader, CardContent } from 'core/components/Card';
import { PageHeader } from 'core/components/PageHeader';
import { EmptyState } from 'core/components/EmptyState';
import { Badge } from 'core/components/Badge';
import { Button } from 'core/components/Button';
import Link from 'next/link';
import { RecentTransactionsCard } from './RecentTransactionsCard';
import { HistoryFilters } from './HistoryFilters';
import { FilterDrawer } from 'core/components/FilterDrawer';

// Cache points history for 2 minutes (points are user-specific and update frequently)
export const revalidate = 120;

interface PointsHistoryPageProps {
  searchParams: Promise<{
    days?: string;
    page?: string;
    startDate?: string;
    endDate?: string;
    type?: string;
    minPoints?: string;
    maxPoints?: string;
    reason?: string;
  }>;
}

export default async function PointsHistoryPage({ searchParams }: PointsHistoryPageProps) {
  const params = await searchParams;
  // Default to all time for extended history view if no filters are set
  const hasAnyFilter = params.days || params.startDate || params.endDate || params.type || params.minPoints || params.maxPoints || params.reason;
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
  
  // Check if using placeholder Supabase (dev mode)
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  
  // Get user ID first (needed for both RecentTransactionsCard and history queries)
  let userId: string | null = null;
  if (!isDevMode) {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    userId = session?.access_token ? getJwtSubject(session.access_token) : null;
    if (!userId) return null;
  }

  let pointsBalance = 0;
  let history: any[] = [];
  let totalEarned = 0;
  let totalSpent = 0;
  let totalCount = 0;
  let hasMore = false;
  
  if (isDevMode) {
    // Mock data for dev mode
    pointsBalance = 2500;
    history = [
      {
        id: '1',
        reason: 'Welcome bonus',
        delta_points: 1000,
        created_at: new Date().toISOString(),
      },
      {
        id: '2',
        reason: 'Monthly reward',
        delta_points: 1500,
        created_at: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: '3',
        reason: 'Order #ABCD1234',
        delta_points: -500,
        created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
      },
      {
        id: '4',
        reason: 'Performance bonus',
        delta_points: 500,
        created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
      },
    ];
    totalEarned = 3000;
    totalSpent = 500;
    totalCount = 4;
  } else {
    const supabase = await createClient();

    // Helper function to build base query with all filters
    const buildFilteredQuery = (query: any) => {
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

    // Build queries for count, totals, and paginated history
    let baseQuery = supabase
      .from('points_ledger')
      .select('*')
      .eq('user_id', userId);
    baseQuery = buildFilteredQuery(baseQuery);

    // Build count query
    let countQuery = supabase
      .from('points_ledger')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    countQuery = buildFilteredQuery(countQuery);

    // Build paginated history query
    let historyQuery = supabase
      .from('points_ledger')
      .select('id, reason, delta_points, created_at')
      .eq('user_id', userId);
    historyQuery = buildFilteredQuery(historyQuery);
    
    historyQuery = historyQuery
      .order('created_at', { ascending: false })
      .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1);

    // Run queries in parallel
    const [balanceResult, countResult, totalsResult, historyResult] = await Promise.all([
      supabase.rpc('get_user_points_balance', { p_user_id: userId }),
      countQuery,
      baseQuery.select('delta_points'), // Get all delta_points for totals calculation
      historyQuery,
    ]);

    pointsBalance = balanceResult.data || 0;
    totalCount = countResult.count || 0;
    hasMore = totalCount > currentPage * itemsPerPage;
    history = historyResult.data || [];

    // Calculate totals for the filtered period (from all records in period)
    const allDeltaPoints = totalsResult.data || [];
    totalEarned = allDeltaPoints
      .filter((entry: any) => entry.delta_points > 0)
      .reduce((sum: number, entry: any) => sum + entry.delta_points, 0) || 0;

    totalSpent = Math.abs(
      allDeltaPoints
        .filter((entry: any) => entry.delta_points < 0)
        .reduce((sum: number, entry: any) => sum + entry.delta_points, 0) || 0
    );
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
      // Check if any other filters are active
      if (type !== 'all' || minPoints !== null || maxPoints !== null || reason) {
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
    const params = new URLSearchParams();
    if (daysFilter !== null) params.set('days', daysFilter.toString());
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    if (type !== 'all') params.set('type', type);
    if (minPoints !== null) params.set('minPoints', minPoints.toString());
    if (maxPoints !== null) params.set('maxPoints', maxPoints.toString());
    if (reason) params.set('reason', reason);
    params.set('page', page.toString());
    return `/points-history?${params.toString()}`;
  };

  return (
    <div>
      <PageHeader 
        title="Points History" 
        subtitle="Track your earnings and redemptions"
      />

      {/* Recent Transactions Card - Always shows last 30 days */}
      <div className="mb-8">
        <RecentTransactionsCard isDevMode={isDevMode} userId={userId} />
      </div>

      {/* Extended History Section */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Left Sidebar - Filters (desktop) / Slide-in drawer (mobile) */}
        <FilterDrawer
          triggerLabel="Filters"
          hasActiveFilters={!!(startDate || endDate || type !== 'all' || minPoints || maxPoints || reason)}
          wrapperClassName="lg:w-52"
        >
          <div className="sticky top-24 pt-4">
            <HistoryFilters currentDays={daysFilter || undefined} />
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-600 mb-2">Current Balance</p>
              <p className="text-4xl font-bold text-gray-900">{pointsBalance.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="py-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-600 mb-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-600 mb-2">Total Earned</p>
              <p className="text-4xl font-bold text-green-600">{totalEarned.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="py-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-600 mb-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-600 mb-2">Total Redeemed</p>
              <p className="text-4xl font-bold text-gray-900">{totalSpent.toLocaleString()}</p>
            </div>
          </CardContent>
          </Card>
          </div>

          {/* Extended Transaction History */}
          <Card>
        <CardHeader className="bg-gray-50">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Transaction History</h2>
            <Badge variant="default">{totalCount} {getFilterLabel()}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {history && history.length > 0 ? (
            <>
              <div className="divide-y">
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start justify-between py-4 first:pt-0 last:pb-0 hover:bg-gray-50 -mx-6 px-6 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
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
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{entry.reason}</p>
                        <p className="text-sm text-gray-500 mt-0.5">
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
                  <div className="text-right ml-4 flex-shrink-0">
                    <p
                      className={`text-2xl font-bold ${
                        entry.delta_points > 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {entry.delta_points > 0 ? '+' : ''}
                      {entry.delta_points.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">points</p>
                  </div>
                </div>
              ))}
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
            <EmptyState
              icon={
                <svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              }
              title="No points activity yet"
              description="Your points transactions will appear here once you start earning and redeeming"
            />
          )}
          </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

