/**
 * Order status vocabulary.
 *
 * The stored values predate the move to pickup-only and still read 'shipped' and
 * 'delivered'. Renaming them in the database would mean migrating every existing order and
 * the status CHECK constraint, so the values stay as they are and everything anyone reads —
 * admin tables, customer pages, emails — goes through the labels below. Keep display text
 * out of individual components: the drift between the Update Order Status dropdown and the
 * dashboard is what made staff think orders were being shipped.
 */

export const ORDER_STATUSES = ['new', 'processing', 'shipped', 'delivered', 'cancelled'] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'New',
  processing: 'Processing',
  shipped: 'Ready for pickup',
  delivered: 'Picked up',
  cancelled: 'Cancelled',
};

/** Falls back to a capitalized raw value so an unexpected status still reads sensibly. */
export function orderStatusLabel(status: string): string {
  return (
    ORDER_STATUS_LABELS[status as OrderStatus] ??
    status.charAt(0).toUpperCase() + status.slice(1)
  );
}

/** Options for the admin status picker, in the order staff move through them. */
export const ORDER_STATUS_OPTIONS = ORDER_STATUSES.map((value) => ({
  value,
  label: ORDER_STATUS_LABELS[value],
}));

/** Badge variant for the customer-facing pages. */
export function orderStatusBadgeVariant(
  status: string
): 'success' | 'info' | 'warning' | 'error' | 'default' {
  switch (status) {
    case 'delivered':
      return 'success';
    case 'shipped':
      return 'info';
    case 'processing':
      return 'warning';
    case 'cancelled':
      return 'error';
    default:
      return 'default';
  }
}

/** Pill classes for the admin tables. */
export function orderStatusPillClasses(status: string): string {
  switch (status) {
    case 'delivered':
      return 'bg-green-100 text-green-900';
    case 'shipped':
      return 'bg-purple-100 text-purple-900';
    case 'processing':
      return 'bg-blue-100 text-blue-900';
    case 'cancelled':
      return 'bg-red-100 text-red-900';
    default:
      return 'bg-yellow-100 text-yellow-900';
  }
}
