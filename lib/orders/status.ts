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

/**
 * Why staff can't move an order from `current` to `next`, or null when they can. Shared by
 * the status picker and the save, so the two never disagree.
 *
 * Cancelling is the Refund button's job while the order still has points out: it gives
 * them back, asks whether the stock goes back too, and cancels the order itself. Picking
 * Cancelled here used to do none of that while telling the customer it was cancelled. And
 * an order whose points have all gone back can't be reopened, or the customer would get
 * the items without paying.
 */
export function statusChangeBlockedReason(
  current: string,
  next: string,
  refunds: { left: number; isFullyRefunded: boolean }
): string | null {
  if (next === current) return null;
  if (next === 'cancelled' && refunds.left > 0) {
    return 'To cancel this order, use Refund: it gives the points back and asks whether the stock goes back too.';
  }
  if (refunds.isFullyRefunded) {
    return "This order's points have all been refunded, so it can't be reopened.";
  }
  return null;
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
