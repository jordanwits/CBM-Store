/**
 * How much of an order has been refunded, for the order pages.
 *
 * The database decides every refund (refund_order_item and refund_order, migration 041);
 * this only reads back what it did, with the same rule: what checkout spent in each bucket,
 * less the positive ledger rows for the order. Reading the ledger rather than the lines is
 * what makes an order refunded before 041, whose lines say nothing, read as refunded.
 */

export interface OrderRefundInput {
  total_points?: number | null;
  restricted_points_used?: number | null;
  universal_points_used?: number | null;
}

export interface LedgerRefundRow {
  delta_points: number;
  point_type?: string | null;
}

export interface OrderRefundSummary {
  refundedRestricted: number;
  refundedUniversal: number;
  refunded: number;
  /** Points the order could still give back. */
  left: number;
  /** Some points went back and none are left. */
  isFullyRefunded: boolean;
  /** Some points went back and some are left: lines were refunded on their own. */
  isPartiallyRefunded: boolean;
}

export function summarizeOrderRefunds(
  order: OrderRefundInput,
  ledgerRefunds: LedgerRefundRow[]
): OrderRefundSummary {
  let restrictedPaid = order.restricted_points_used ?? 0;
  let universalPaid = order.universal_points_used ?? 0;

  // Orders from before the two buckets were paid entirely from universal
  if (restrictedPaid === 0 && universalPaid === 0) {
    universalPaid = order.total_points ?? 0;
  }

  let refundedRestricted = 0;
  let refundedUniversal = 0;

  for (const row of ledgerRefunds) {
    if (row.delta_points <= 0) continue;

    if (row.point_type === 'restricted') {
      refundedRestricted += row.delta_points;
    } else {
      refundedUniversal += row.delta_points;
    }
  }

  const refunded = refundedRestricted + refundedUniversal;
  const left =
    Math.max(restrictedPaid - refundedRestricted, 0) + Math.max(universalPaid - refundedUniversal, 0);

  return {
    refundedRestricted,
    refundedUniversal,
    refunded,
    left,
    isFullyRefunded: refunded > 0 && left === 0,
    isPartiallyRefunded: refunded > 0 && left > 0,
  };
}

export interface OrderItemRefundInput {
  refunded_restricted_points?: number | null;
  refunded_universal_points?: number | null;
}

/** Points that went back to the customer for one refunded line. */
export function orderItemRefundedPoints(item: OrderItemRefundInput): number {
  return (item.refunded_restricted_points ?? 0) + (item.refunded_universal_points ?? 0);
}
