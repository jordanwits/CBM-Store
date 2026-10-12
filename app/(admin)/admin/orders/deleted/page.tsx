import { createClient } from '@/lib/supabase/server';
import { Card, CardHeader, CardContent } from 'core/components/Card';
import { BackButton } from 'core/components/BackButton';
import { FormattedDate } from 'core/components/FormattedDate';
import { orderStatusLabel } from '@/lib/orders/status';
import { RestoreOrderButton } from './RestoreOrderButton';

// Old enough deletions stop mattering long before this; it only keeps the page bounded
const MAX_ROWS = 200;

interface DeletedOrderRow {
  orderId: string;
  status: string;
  totalPoints: number;
  placedAt: string | null;
  deletedAt: string;
  customer: string;
  deletedBy: string;
  units: number;
  note: string | null;
}

function contactLabel(profile?: { email?: string | null; phone?: string | null } | null): string {
  return profile?.email?.trim() || profile?.phone?.trim() || 'N/A';
}

export default async function DeletedOrdersPage() {
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');

  let rows: DeletedOrderRow[] = [];
  let loadError = false;

  if (!isDevMode) {
    const supabase = await createClient();

    const { data: binned, error } = await supabase
      .from('deleted_orders')
      .select('order_id, order_data, items_data, deleted_at, deleted_by')
      .order('deleted_at', { ascending: false })
      .limit(MAX_ROWS);

    if (error) {
      // Most likely migration 038 has not been run yet
      console.error('Error loading deleted orders:', error);
      loadError = true;
    }

    const entries = binned ?? [];

    // The customer lives inside the snapshot, so there is no foreign key to embed through;
    // one lookup covers every customer and every admin on the page.
    const profileIds = [
      ...new Set(
        entries
          .flatMap((entry: any) => [entry.order_data?.user_id, entry.deleted_by])
          .filter((id: unknown): id is string => typeof id === 'string')
      ),
    ];

    const profilesById = new Map<string, { email?: string | null; phone?: string | null }>();

    if (profileIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, phone')
        .in('id', profileIds);

      for (const profile of profiles ?? []) {
        profilesById.set(profile.id, profile);
      }
    }

    rows = entries.map((entry: any) => {
      const order = entry.order_data ?? {};
      const items: Array<{ quantity?: number }> = Array.isArray(entry.items_data)
        ? entry.items_data
        : [];

      return {
        orderId: entry.order_id,
        status: order.status ?? 'new',
        totalPoints: order.total_points ?? 0,
        placedAt: order.created_at ?? null,
        deletedAt: entry.deleted_at,
        customer: order.user_id
          ? contactLabel(profilesById.get(order.user_id))
          : 'N/A',
        // A delete run outside the app (SQL editor, a cascade) has no admin to name
        deletedBy: entry.deleted_by ? contactLabel(profilesById.get(entry.deleted_by)) : '—',
        units: items.reduce((sum, item) => sum + (item.quantity ?? 0), 0),
        note: order.customer_note?.trim() || order.notes?.trim() || null,
      };
    });
  }

  return (
    <div>
      <BackButton href="/admin/orders" label="Back to Orders" className="mb-4" />
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Deleted Orders</h1>
        <p className="text-gray-600 mt-1">
          Orders removed with Delete. Restoring one puts it back exactly as it was, items included.
          Points and inventory are not changed either way.
        </p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Deleted orders</h2>
          {rows.length >= MAX_ROWS && (
            <p className="text-sm text-gray-600 mt-1">Showing the {MAX_ROWS} most recent.</p>
          )}
        </CardHeader>
        <CardContent>
          {loadError ? (
            <p className="text-red-700 text-center py-8">
              Deleted orders could not be loaded. The database may still need migration 038.
            </p>
          ) : rows.length === 0 ? (
            <p className="text-gray-700 text-center py-8">
              {isDevMode ? 'Configure Supabase to see real data' : 'No deleted orders'}
            </p>
          ) : (
            <>
              {/* Mobile card layout - hidden on md+ */}
              <div className="md:hidden space-y-4">
                {rows.map((row) => (
                  <Card key={row.orderId}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-primary font-semibold font-mono text-sm">
                          #{row.orderId.slice(0, 8).toUpperCase()}
                        </span>
                        <span className="text-sm font-semibold text-gray-900">
                          {row.totalPoints} pts
                        </span>
                      </div>
                      <p className="text-sm text-gray-900 truncate">{row.customer}</p>
                      {row.note && (
                        <p className="text-xs text-gray-700 whitespace-pre-wrap break-words">
                          Note: {row.note}
                        </p>
                      )}
                      <p className="text-xs text-gray-600">
                        {row.units} {row.units === 1 ? 'item' : 'items'} ·{' '}
                        {orderStatusLabel(row.status)} when deleted
                      </p>
                      <p className="text-xs text-gray-600">
                        Deleted <FormattedDate date={row.deletedAt} format="datetimeShort" /> by{' '}
                        {row.deletedBy}
                      </p>
                      <div className="pt-2 border-t border-gray-100">
                        <RestoreOrderButton orderId={row.orderId} />
                      </div>
                    </CardContent>
                  </Card>
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
                        Points
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                        Items
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                        Placed
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                        Deleted
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {rows.map((row) => (
                      <tr key={row.orderId}>
                        <td className="px-4 py-3 text-sm font-mono text-primary font-semibold align-top">
                          {row.orderId.slice(0, 8)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 align-top">
                          {row.customer}
                          {row.note && (
                            <span className="block max-w-md whitespace-pre-wrap break-words text-xs text-gray-700 mt-0.5">
                              Note: {row.note}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900 align-top">
                          {row.totalPoints}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 align-top">
                          {row.units}
                          <span className="block text-xs text-gray-600 mt-0.5">
                            {orderStatusLabel(row.status)} when deleted
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 align-top">
                          {row.placedAt ? <FormattedDate date={row.placedAt} format="date" /> : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 align-top">
                          <FormattedDate date={row.deletedAt} format="datetimeShort" />
                          <span className="block text-xs text-gray-600 mt-0.5">by {row.deletedBy}</span>
                        </td>
                        <td className="px-4 py-3 text-sm align-top">
                          <RestoreOrderButton orderId={row.orderId} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
