/**
 * What an order line actually asks of the fulfillment team, and how to name it.
 *
 * Since 037 a made-to-order line draws whatever is on hand before the rest is made, so the
 * flag alone no longer answers "how many do we make?" — a line of 3 with 1 on the shelf
 * needs 2. Anything that shows order lines reads the count through here so a partial draw
 * is never rounded up to "make all of them" or silently dropped.
 */

export interface OrderItemFulfillmentInput {
  quantity: number;
  units_from_stock?: number | null;
  made_to_order?: boolean | null;
}

export interface OrderItemVariantInput {
  variant_name?: string | null;
  variant_size?: string | null;
  variant_color?: string | null;
}

/**
 * How to name a line's variant wherever the line is listed for a human — pickup notices,
 * order tables, emails.
 *
 * Size and colour are the dimensions since 036, but a variant that predates them, or one
 * whose meaning isn't a size or a colour, carries it in the name alone. Null when the line
 * has no variant worth printing.
 */
export function orderItemVariantLabel(item: OrderItemVariantInput): string | null {
  const dimensions = [item.variant_size, item.variant_color]
    .map((value) => value?.trim())
    .filter((value): value is string => !!value?.length);

  if (dimensions.length > 0) {
    return dimensions.join(' · ');
  }

  return item.variant_name?.trim() || null;
}

export interface OrderItemProcurement {
  label: string;
  /** Pill classes for the admin tables, matching orderStatusPillClasses. */
  pillClasses: string;
}

/**
 * Units the team has to procure for this line.
 *
 * A stocked line is never made, whatever its count says — an untracked variant records
 * no units_from_stock, and reading that as "make all of them" would put every unstocked
 * mug and keychain on the procurement list.
 */
export function unitsToMake(item: OrderItemFulfillmentInput): number {
  if (!item.made_to_order) {
    return 0;
  }

  return Math.max(0, item.quantity - (item.units_from_stock ?? 0));
}

/**
 * Where a single line has got to, independent of the order's own status.
 *
 * Added in 039. orders.status still describes the order as a whole; these describe the
 * lines under it, which is the only place "three of the four are collectable" can live.
 */
export const ITEM_FULFILLMENT_STATUSES = ['pending', 'ready', 'picked_up'] as const;

export type ItemFulfillmentStatus = (typeof ITEM_FULFILLMENT_STATUSES)[number];

export const ITEM_FULFILLMENT_LABELS: Record<ItemFulfillmentStatus, string> = {
  pending: 'Not ready',
  ready: 'Ready for pickup',
  picked_up: 'Picked up',
};

/** Falls back to the raw value so an unexpected state still reads as something. */
export function itemFulfillmentLabel(status: string): string {
  return ITEM_FULFILLMENT_LABELS[status as ItemFulfillmentStatus] ?? status;
}

export function itemFulfillmentPillClasses(status: string): string {
  switch (status) {
    case 'picked_up':
      return 'bg-green-100 text-green-900';
    case 'ready':
      return 'bg-purple-100 text-purple-900';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export interface OrderFulfillmentSummary {
  total: number;
  pending: number;
  ready: number;
  pickedUp: number;
  /** Lines the customer cannot collect yet. */
  outstanding: number;
  /**
   * Some lines have moved and others have not — the case the order-level status cannot
   * express. A brand-new order has everything pending and is deliberately not "partial",
   * or every order in the list would carry the flag.
   */
  isPartiallyFulfilled: boolean;
  /** Every line handed over. */
  isComplete: boolean;
}

export function summarizeFulfillment(
  items: Array<{ fulfillment_status?: string | null }>
): OrderFulfillmentSummary {
  let pending = 0;
  let ready = 0;
  let pickedUp = 0;

  for (const item of items) {
    switch (item.fulfillment_status) {
      case 'picked_up':
        pickedUp += 1;
        break;
      case 'ready':
        ready += 1;
        break;
      default:
        pending += 1;
    }
  }

  const total = items.length;

  return {
    total,
    pending,
    ready,
    pickedUp,
    outstanding: pending,
    isPartiallyFulfilled: pending > 0 && ready + pickedUp > 0,
    isComplete: total > 0 && pickedUp === total,
  };
}

/** Null for a line with nothing to say: a stocked product came off the shelf as always. */
export function orderItemProcurement(
  item: OrderItemFulfillmentInput
): OrderItemProcurement | null {
  if (!item.made_to_order) {
    return null;
  }

  const toMake = unitsToMake(item);

  if (toMake <= 0) {
    return { label: 'From stock', pillClasses: 'bg-green-100 text-green-900' };
  }

  if (toMake < item.quantity) {
    return {
      label: `Make ${toMake} of ${item.quantity}`,
      pillClasses: 'bg-amber-100 text-amber-900',
    };
  }

  return { label: 'Made to Order', pillClasses: 'bg-amber-100 text-amber-900' };
}
