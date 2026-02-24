import { createClient } from '@/lib/supabase/server';
import { getJwtSubject } from '@/lib/auth/jwt';
import { Card, CardHeader, CardContent } from 'core/components/Card';
import { Badge } from 'core/components/Badge';

interface RecentTransactionsCardProps {
  isDevMode: boolean;
  userId: string | null;
}

export async function RecentTransactionsCard({ isDevMode, userId }: RecentTransactionsCardProps) {
  let recentTransactions: any[] = [];
  let recentCount = 0;

  if (isDevMode) {
    // Mock data for dev mode - last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    recentTransactions = [
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
    ].filter(t => new Date(t.created_at) >= thirtyDaysAgo);
    recentCount = recentTransactions.length;
  } else if (userId) {
    const supabase = await createClient();
    
    // Calculate date cutoff for last 30 days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);
    const cutoffISO = cutoffDate.toISOString();

    // Fetch recent transactions (last 30 days) and count in parallel
    const [countResult, transactionsResult] = await Promise.all([
      supabase
        .from('points_ledger')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', cutoffISO),
      supabase
        .from('points_ledger')
        .select('id, reason, delta_points, created_at')
        .eq('user_id', userId)
        .gte('created_at', cutoffISO)
        .order('created_at', { ascending: false })
        .limit(10), // Show up to 10 most recent transactions
    ]);

    recentCount = countResult.count || 0;
    recentTransactions = transactionsResult.data || [];
  }

  return (
    <Card>
      <CardHeader className="bg-gray-50">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recent Transactions</h2>
          <div className="flex items-center gap-2">
            <Badge variant="default">Last 30 days</Badge>
            {recentCount > 0 && (
              <Badge variant="default">{recentCount} total</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {recentTransactions && recentTransactions.length > 0 ? (
          <>
            <div className="divide-y">
              {recentTransactions.map((entry) => (
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
          </>
        ) : (
          <div className="py-8 text-center">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-sm text-gray-600">No transactions in the last 30 days</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

