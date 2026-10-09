/**
 * The two free-text notes an order carries, and the rules they share.
 *
 * orders.customer_note (036) is what the customer wrote at checkout. Staff and the customer
 * both see it. orders.notes is what staff write about the order, and only staff see it.
 * They are kept in separate columns so neither side's text can reach the other by accident.
 */

/** Matches the CHECK on orders.customer_note and the guard in place_points_order. */
export const ORDER_NOTE_MAX_LENGTH = 1000;

/**
 * Trims a note and turns an empty one into null, so a box left blank or full of spaces
 * stores nothing rather than an empty string that every page would have to special-case.
 */
export function normalizeOrderNote(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
