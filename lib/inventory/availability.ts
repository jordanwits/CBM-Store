/**
 * What the storefront tells a customer about stock.
 *
 * Counts live only on product_variants.inventory_count. A NULL there means the variant is
 * untracked and checkout never gates it, so the customer can always have one: untracked
 * reads as available, just with no number attached. 0 is a different thing entirely and
 * does mean sold out. Every customer-facing surface reads stock through here so the wording
 * cannot drift between the catalog card, the product page, the cart, checkout and the order
 * confirmation, the way the order status labels drifted before lib/orders/status.ts pulled
 * them together.
 *
 * Bands rather than raw counts. Catalog, cart and product data is cached for five minutes
 * (lib/cache/store-data.ts), so an exact number can be stale in the direction that hurts:
 * showing "1 left" to someone checkout is about to reject. A band survives being slightly
 * out of date, and the exact figure only appears once it is low enough to be worth acting
 * on.
 *
 * Made-to-order products sell from stock first and get made after (migration 037), so their
 * on-hand count still matters: a line covered by what is on the shelf carries no delay and
 * should not be dressed up as one.
 */

/** At or below this many units on hand, the customer sees the actual number. */
export const LOW_STOCK_THRESHOLD = 5;

export type AvailabilityState = 'in_stock' | 'low_stock' | 'made_to_order' | 'out_of_stock';

export type AvailabilityTone = 'positive' | 'caution' | 'made' | 'negative';

export interface Availability {
  state: AvailabilityState;
  /** Units on hand, or null where nothing relevant is tracked and there is no number to give. */
  unitsOnHand: number | null;
  /** Short pill text. */
  label: string;
  /** A sentence for surfaces with room for one. Null when the label already says it all. */
  detail: string | null;
  tone: AvailabilityTone;
  /**
   * False only when a stocked line cannot cover the quantity asked for, which is exactly
   * the case place_points_order will reject. Made-to-order lines are always true: running
   * out means "we make it", not "you cannot have it".
   */
  sufficient: boolean;
  /** Units of the requested quantity that have to be made rather than picked off a shelf. */
  unitsToMake: number;
}

export interface StockVariant {
  inventory_count?: number | null;
  active?: boolean | null;
}

/** Badge component variant, for surfaces built out of core/components/Badge. */
export function availabilityBadgeVariant(
  tone: AvailabilityTone
): 'success' | 'warning' | 'info' | 'error' {
  switch (tone) {
    case 'positive':
      return 'success';
    case 'caution':
      return 'warning';
    case 'made':
      return 'info';
    case 'negative':
      return 'error';
  }
}

/** Pill classes for surfaces that style their own spans, matching orderStatusPillClasses. */
export function availabilityPillClasses(tone: AvailabilityTone): string {
  switch (tone) {
    case 'positive':
      return 'bg-green-100 text-green-900';
    case 'caution':
      return 'bg-amber-100 text-amber-900';
    case 'made':
      return 'bg-blue-100 text-blue-900';
    case 'negative':
      return 'bg-red-100 text-red-900';
  }
}

/** Available, with no count to quote: untracked stock, or a product with no variants. */
const AVAILABLE_UNCOUNTED: Availability = {
  state: 'in_stock',
  unitsOnHand: null,
  label: 'In stock',
  detail: null,
  tone: 'positive',
  sufficient: true,
  unitsToMake: 0,
};

/**
 * A cart line pointing at a variant the storefront can no longer see, because it was
 * deactivated or deleted after being added. The storefront only ever loads active variants,
 * so the line would otherwise inherit the "available, nothing tracked" reading of a variant
 * that simply has no count, while place_points_order rejects it outright.
 */
export const VARIANT_UNAVAILABLE: Availability = {
  state: 'out_of_stock',
  unitsOnHand: null,
  label: 'No longer available',
  detail: 'This option is no longer offered. Remove it from your cart to continue.',
  tone: 'negative',
  sufficient: false,
  unitsToMake: 0,
};

/**
 * A count left negative by a manual edit is not stock to give away, the same guard
 * place_points_order applies before drawing a made-to-order line down.
 */
function onHandFrom(variant: StockVariant | null | undefined): number | null {
  const count = variant?.inventory_count;
  if (count === null || count === undefined) return null;
  return Math.max(0, count);
}

/**
 * An untracked made-to-order variant counts as nothing on hand. Better to promise a wait
 * that turns out to be unnecessary than to promise stock the store cannot confirm.
 */
function madeToOrderAvailability(onHand: number | null, quantity: number): Availability {
  const available = onHand ?? 0;
  const toMake = Math.max(0, quantity - available);

  if (toMake <= 0) {
    return {
      state: 'in_stock',
      unitsOnHand: onHand,
      label: 'In stock',
      detail: null,
      tone: 'positive',
      sufficient: true,
      unitsToMake: 0,
    };
  }

  return {
    state: 'made_to_order',
    unitsOnHand: onHand,
    label: 'Made to order',
    detail:
      available > 0
        ? `We have ${available} of these on hand. We'll order the other ${toMake} once you place your order.`
        : "We don't have this one on hand. We'll order it once you place your order.",
    tone: 'made',
    sufficient: true,
    unitsToMake: toMake,
  };
}

/**
 * Availability of one specific variant, for a specific quantity.
 *
 * Used wherever the customer has already chosen what they want: the product page after a
 * selection, each cart line, each checkout line.
 */
export function variantAvailability(
  variant: StockVariant | null | undefined,
  madeToOrder: boolean,
  quantity: number = 1
): Availability {
  const onHand = onHandFrom(variant);
  const wanted = Math.max(1, quantity);

  if (madeToOrder) {
    return madeToOrderAvailability(onHand, wanted);
  }

  if (onHand === null) {
    return AVAILABLE_UNCOUNTED;
  }

  if (onHand === 0) {
    return {
      state: 'out_of_stock',
      unitsOnHand: 0,
      label: 'Out of stock',
      detail: null,
      tone: 'negative',
      sufficient: false,
      unitsToMake: 0,
    };
  }

  if (onHand < wanted) {
    return {
      state: 'low_stock',
      unitsOnHand: onHand,
      label: `Only ${onHand} left`,
      detail: `You have ${wanted} of these selected and only ${onHand} ${
        onHand === 1 ? 'is' : 'are'
      } available.`,
      tone: 'caution',
      sufficient: false,
      unitsToMake: 0,
    };
  }

  if (onHand <= LOW_STOCK_THRESHOLD) {
    return {
      state: 'low_stock',
      unitsOnHand: onHand,
      label: `Only ${onHand} left`,
      detail: null,
      tone: 'caution',
      sufficient: true,
      unitsToMake: 0,
    };
  }

  return {
    state: 'in_stock',
    unitsOnHand: onHand,
    label: 'In stock',
    detail: null,
    tone: 'positive',
    sufficient: true,
    unitsToMake: 0,
  };
}

/**
 * Availability of a product as a whole, for surfaces that show it before the customer has
 * picked a variant: the catalog card and the product page badge.
 *
 * A single untracked active variant sinks the whole total. Adding "available, quantity
 * unknown" into a sum would either invent depth the store cannot back or read as "only 2
 * left" while an unlimited variant sits next to it, so such a product reports as available
 * with no figure attached. Same for a product with no variants at all: stock has nowhere to
 * live on it and checkout never gates it.
 */
export function productAvailability(
  variants: readonly StockVariant[] | null | undefined,
  madeToOrder: boolean
): Availability {
  if (madeToOrder) {
    return {
      state: 'made_to_order',
      unitsOnHand: null,
      label: 'Made to order',
      detail:
        "We order this one once you place your order, so it isn't ready to collect right away.",
      tone: 'made',
      sufficient: true,
      unitsToMake: 0,
    };
  }

  const active = (variants || []).filter((v) => v.active !== false);

  if (active.length === 0) {
    return AVAILABLE_UNCOUNTED;
  }

  let total = 0;

  for (const variant of active) {
    const onHand = onHandFrom(variant);
    if (onHand === null) {
      return AVAILABLE_UNCOUNTED;
    }
    total += onHand;
  }

  if (total === 0) {
    return {
      state: 'out_of_stock',
      unitsOnHand: 0,
      label: 'Out of stock',
      detail: null,
      tone: 'negative',
      sufficient: false,
      unitsToMake: 0,
    };
  }

  if (total <= LOW_STOCK_THRESHOLD) {
    return {
      state: 'low_stock',
      unitsOnHand: total,
      label: `Only ${total} left`,
      detail: null,
      tone: 'caution',
      sufficient: true,
      unitsToMake: 0,
    };
  }

  return {
    state: 'in_stock',
    unitsOnHand: total,
    label: 'In stock',
    detail: null,
    tone: 'positive',
    sufficient: true,
    unitsToMake: 0,
  };
}
