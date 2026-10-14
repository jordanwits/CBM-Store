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
  fulfillment_status?: string | null;
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
  // A refunded line is not being supplied any more, so there is nothing to procure for it
  if (!item.made_to_order || isItemRefunded(item.fulfillment_status)) {
    return 0;
  }

  return Math.max(0, item.quantity - (item.units_from_stock ?? 0));
}

/**
 * Where a single line has got to, independent of the order's own status.
 *
 * Added in 039. orders.status still describes the order as a whole; these describe the
 * lines under it, which is the only place "three of the four are collectable" can live.
 *
 * 'ordered' is a made-to-order line that has been ordered in but has not arrived. It is
 * still not ready: nothing is set aside for the customer and nothing leaves inventory.
 */
export const ITEM_FULFILLMENT_STATUSES = ['pending', 'ordered', 'ready', 'picked_up'] as const;

export type ItemFulfillmentStatus = (typeof ITEM_FULFILLMENT_STATUSES)[number];

export const ITEM_FULFILLMENT_LABELS: Record<ItemFulfillmentStatus, string> = {
  pending: 'Not ready',
  ordered: 'Ordered',
  ready: 'Ready for pickup',
  picked_up: 'Picked up',
};

/**
 * A refunded line (041): its points went back to the customer and it is no longer part of
 * what the order is waiting on. It is not one of ITEM_FULFILLMENT_STATUSES because staff
 * cannot pick it from the dropdown — only a refund puts a line there, and nothing takes it
 * back out.
 */
export const ITEM_REFUNDED_STATUS = 'refunded';

export function isItemRefunded(status: string | null | undefined): boolean {
  return status === ITEM_REFUNDED_STATUS;
}

/**
 * The line cannot be collected yet: not ready, or ordered and on its way. Anything that
 * asks "is this outstanding?" goes through here, so 'ordered' is never mistaken for ready.
 */
export function isItemAwaitingReady(status: string | null | undefined): boolean {
  return !status || status === 'pending' || status === 'ordered';
}

/** Falls back to the raw value so an unexpected state still reads as something. */
export function itemFulfillmentLabel(status: string): string {
  if (isItemRefunded(status)) {
    return 'Refunded';
  }

  return ITEM_FULFILLMENT_LABELS[status as ItemFulfillmentStatus] ?? status;
}

export function itemFulfillmentPillClasses(status: string): string {
  switch (status) {
    case ITEM_REFUNDED_STATUS:
      return 'bg-rose-100 text-rose-900';
    case 'picked_up':
      return 'bg-green-100 text-green-900';
    case 'ready':
      return 'bg-purple-100 text-purple-900';
    case 'ordered':
      return 'bg-blue-100 text-blue-900';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export interface OrderFulfillmentSummary {
  /** Lines still part of the order: refunded lines are counted apart, not in here. */
  total: number;
  /** Lines not collectable yet, ordered ones included. */
  pending: number;
  /** Of the pending lines, those ordered in and on their way. */
  ordered: number;
  ready: number;
  pickedUp: number;
  /** Lines refunded on their own (041), which the order no longer waits on. */
  refunded: number;
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
  let ordered = 0;
  let ready = 0;
  let pickedUp = 0;
  let refunded = 0;

  for (const item of items) {
    switch (item.fulfillment_status) {
      case ITEM_REFUNDED_STATUS:
        refunded += 1;
        break;
      case 'picked_up':
        pickedUp += 1;
        break;
      case 'ready':
        ready += 1;
        break;
      case 'ordered':
        ordered += 1;
        pending += 1;
        break;
      default:
        pending += 1;
    }
  }

  const total = items.length - refunded;

  return {
    total,
    pending,
    ordered,
    ready,
    pickedUp,
    refunded,
    outstanding: pending,
    isPartiallyFulfilled: pending > 0 && ready + pickedUp > 0,
    isComplete: total > 0 && pickedUp === total,
  };
}

/** Null for a line with nothing to say: a stocked product came off the shelf as always. */
export function orderItemProcurement(
  item: OrderItemFulfillmentInput
): OrderItemProcurement | null {
  if (!item.made_to_order || isItemRefunded(item.fulfillment_status)) {
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

export interface OrderItemReadyStockInput extends OrderItemFulfillmentInput {
  units_from_stock_at_ready?: number | null;
}

/**
 * What marking a made-to-order line ready does, or did, to inventory, for the admin order
 * table. The made units leave stock when the line leaves "not ready", so staff need to know
 * beforehand that the arrivals should already be counted in.
 *
 * variantInventory is the variant's current count: null means the variant is untracked (or
 * gone), in which case marking ready takes nothing and there is nothing to warn about.
 */
export function orderItemReadyStockNote(
  item: OrderItemReadyStockInput,
  variantInventory: number | null | undefined
): string | null {
  // The refund itself says what happened to its stock
  if (isItemRefunded(item.fulfillment_status)) {
    return null;
  }

  const taken = item.units_from_stock_at_ready ?? 0;

  if (taken > 0) {
    return `${taken} taken from inventory when marked ready`;
  }

  const toMake = unitsToMake(item);

  if (
    toMake > 0 &&
    isItemAwaitingReady(item.fulfillment_status) &&
    typeof variantInventory === 'number'
  ) {
    return `Marking ready takes ${toMake} from inventory`;
  }

  return null;
}
