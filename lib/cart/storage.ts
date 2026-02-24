import type { Cart, CartItem } from './types';

const CART_KEY = 'cbm_cart_v1';

/**
 * Get the current cart from localStorage
 * Returns empty cart if not found or invalid
 */
export function getCart(): Cart {
  if (typeof window === 'undefined') {
    return { items: [] };
  }

  try {
    const stored = localStorage.getItem(CART_KEY);
    if (!stored) {
      return { items: [] };
    }
    const parsed = JSON.parse(stored);
    return parsed && Array.isArray(parsed.items) ? parsed : { items: [] };
  } catch {
    return { items: [] };
  }
}

/**
 * Save cart to localStorage and trigger update event
 */
export function setCart(cart: Cart): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    // Trigger custom event for cart updates in the same tab
    window.dispatchEvent(new Event('cartUpdated'));
  } catch (error) {
    console.error('Failed to save cart:', error);
  }
}

/**
 * Add an item to the cart or update quantity if already exists
 */
export function addToCart(productId: string, variantId: string | undefined, quantity: number): void {
  const cart = getCart();
  
  const existingIndex = cart.items.findIndex(
    (item) => item.productId === productId && item.variantId === variantId
  );

  if (existingIndex >= 0) {
    // Update existing item quantity
    cart.items[existingIndex].quantity += quantity;
  } else {
    // Add new item
    cart.items.push({ productId, variantId, quantity });
  }

  setCart(cart);
}

/**
 * Update quantity for a specific cart item
 */
export function updateCartItemQuantity(
  productId: string,
  variantId: string | undefined,
  quantity: number
): void {
  const cart = getCart();
  
  const itemIndex = cart.items.findIndex(
    (item) => item.productId === productId && item.variantId === variantId
  );

  if (itemIndex >= 0) {
    if (quantity <= 0) {
      // Remove item if quantity is 0 or negative
      cart.items.splice(itemIndex, 1);
    } else {
      cart.items[itemIndex].quantity = quantity;
    }
    setCart(cart);
  }
}

/**
 * Remove an item from the cart
 */
export function removeFromCart(productId: string, variantId: string | undefined): void {
  const cart = getCart();
  cart.items = cart.items.filter(
    (item) => !(item.productId === productId && item.variantId === variantId)
  );
  setCart(cart);
}

/**
 * Clear all items from the cart
 */
export function clearCart(): void {
  setCart({ items: [] });
}

/**
 * Get the total number of items in the cart
 */
export function getCartItemCount(): number {
  const cart = getCart();
  return cart.items.reduce((sum, item) => sum + item.quantity, 0);
}
