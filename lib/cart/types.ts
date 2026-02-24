export interface CartItem {
  productId: string;
  variantId?: string;
  quantity: number;
}

export interface Cart {
  items: CartItem[];
}

export interface CartItemWithDetails extends CartItem {
  productName: string;
  variantName?: string;
  pointsPerItem: number;
  totalPoints: number;
  imageUrl?: string;
}
