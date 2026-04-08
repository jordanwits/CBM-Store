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
  /** Product has Affinity collection — CBM points can apply to this line */
  affinityEligible?: boolean;
}
