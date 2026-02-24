'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardHeader, CardContent } from 'core/components/Card';
import { PageHeader } from 'core/components/PageHeader';
import { EmptyState } from 'core/components/EmptyState';
import { Skeleton } from 'core/components/Skeleton';
import { BackButton } from 'core/components/BackButton';
import { Button } from 'core/components/Button';
import Link from 'next/link';
import Image from 'next/image';
import { getCart, updateCartItemQuantity, removeFromCart, clearCart } from '@/lib/cart/storage';
import type { CartItemWithDetails, CartItem } from '@/lib/cart/types';
import { getCartProductData } from './actions';

interface CartPageClientProps {
  isDevMode: boolean;
}

// Mock data for dev mode
const mockProducts = [
  { id: '1', name: 'Company Logo T-Shirt', base_usd: 25.00, images: ['/ChrisCrossBlackCottonT-Shirt.webp'] },
  { id: '2', name: 'Insulated Water Bottle', base_usd: 35.00, images: ['/KiyoUVC-Bottle_Studio_Fullsize-500ml_Black_C2_4480x.jpg'] },
  { id: '3', name: 'Laptop Backpack', base_usd: 75.00, images: ['/1200W-18684-Black-0-NKDH7709BlackBagFront3.jpg'] },
  { id: '4', name: 'Wireless Mouse', base_usd: 45.00, images: ['/b43457a0-76b6-11f0-9faf-5258f188704a.png'] },
  { id: '5', name: 'Notebook Set', base_usd: 20.00, images: ['/moleskine-classic-hardcover-notebook-black.webp'] },
];

export default function CartPageClient({ isDevMode }: CartPageClientProps) {
  const [cartItems, setCartItems] = useState<CartItemWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadCart = useCallback(async () => {
    const cart = getCart();
    
    if (cart.items.length === 0) {
      setCartItems([]);
      setIsLoading(false);
      return;
    }

    let products: any[] = [];
    let variants: any[] = [];
    let conversionRate = 100;

    if (isDevMode) {
      products = mockProducts;
    } else {
      // Fetch only the products in the cart via server action - much faster!
      const data = await getCartProductData(cart.items);
      products = data.products;
      variants = data.variants;
      conversionRate = data.conversionRate;
    }
    
    // Enrich cart items with product/variant details
    const enriched: CartItemWithDetails[] = cart.items.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      const variant = item.variantId
        ? variants.find((v) => v.id === item.variantId)
        : undefined;

      if (!product) {
        // Product not found - return a minimal item
        return {
          ...item,
          productName: 'Unknown Product',
          pointsPerItem: 0,
          totalPoints: 0,
        };
      }

      const basePoints = Math.round(product.base_usd * conversionRate);
      const variantAdjustment = variant
        ? Math.round(variant.price_adjustment_usd * conversionRate)
        : 0;
      const pointsPerItem = basePoints + variantAdjustment;

      return {
        ...item,
        productName: product.name,
        variantName: variant?.name,
        pointsPerItem,
        totalPoints: pointsPerItem * item.quantity,
        imageUrl: product.images?.[0],
      };
    });

    setCartItems(enriched);
    setIsLoading(false);
  }, [isDevMode]);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  const handleUpdateQuantity = (productId: string, variantId: string | undefined, quantity: number) => {
    updateCartItemQuantity(productId, variantId, quantity);
    loadCart();
  };

  const handleRemove = (productId: string, variantId: string | undefined) => {
    removeFromCart(productId, variantId);
    loadCart();
  };

  const handleClearCart = () => {
    if (confirm('Are you sure you want to clear your cart?')) {
      clearCart();
      loadCart();
    }
  };

  const totalPoints = cartItems.reduce((sum, item) => sum + item.totalPoints, 0);
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Shopping Cart" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton height={200} />
            <Skeleton height={200} />
          </div>
          <div>
            <Skeleton height={300} />
          </div>
        </div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div>
        <PageHeader title="Shopping Cart" />
        <Card>
          <CardContent>
            <EmptyState
              icon={
                <svg className="w-20 h-20 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              }
              title="Your cart is empty"
              description="Start shopping and add items to your cart to redeem with your points"
              action={
                <Link href="/dashboard">
                  <Button variant="primary" size="lg">Browse Shop</Button>
                </Link>
              }
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <BackButton href="/dashboard" label="Continue Shopping" className="mb-4" />
      <PageHeader 
        title="Shopping Cart" 
        subtitle={`${totalItems} ${totalItems === 1 ? 'item' : 'items'} in your cart`}
        actions={
          <Button variant="outline" size="sm" onClick={handleClearCart}>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Clear Cart
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {cartItems.map((item) => (
            <Card 
              key={`${item.productId}-${item.variantId || 'default'}`}
              className="hover:shadow-md transition-shadow"
            >
              <CardContent className="p-4 sm:p-6">
                <div className="flex gap-4">
                  {/* Product Image */}
                  <Link 
                    href={`/product/${item.productId}`}
                    className="w-24 h-24 sm:w-32 sm:h-32 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg overflow-hidden flex-shrink-0 hover:opacity-80 transition-opacity"
                  >
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={item.productName}
                        width={128}
                        height={128}
                        className="object-cover object-[center_30%] w-full h-full"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </Link>

                  {/* Product Details */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <Link 
                        href={`/product/${item.productId}`}
                        className="text-lg font-semibold text-gray-900 hover:text-primary line-clamp-1"
                      >
                        {item.productName}
                      </Link>
                      {item.variantName && (
                        <p className="text-sm text-gray-600 mt-1">Option: {item.variantName}</p>
                      )}
                      <p className="text-sm text-gray-500 mt-1">
                        {item.pointsPerItem.toLocaleString()} points each
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-4">
                      {/* Quantity Controls */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            handleUpdateQuantity(item.productId, item.variantId, item.quantity - 1)
                          }
                          className="w-9 h-9 rounded-lg border-2 border-gray-400 hover:border-primary hover:bg-primary/10 flex items-center justify-center font-bold text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:border-gray-300"
                          disabled={item.quantity <= 1}
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span className="w-12 text-center font-bold text-lg text-gray-900">{item.quantity}</span>
                        <button
                          onClick={() =>
                            handleUpdateQuantity(item.productId, item.variantId, item.quantity + 1)
                          }
                          className="w-9 h-9 rounded-lg border-2 border-gray-400 hover:border-primary hover:bg-primary/10 flex items-center justify-center font-bold text-gray-900 transition-colors"
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>

                      {/* Price & Remove */}
                      <div className="text-left sm:text-right">
                        <p className="text-xl font-bold text-secondary">
                          {item.totalPoints.toLocaleString()} <span className="text-sm">pts</span>
                        </p>
                        <button
                          onClick={() => handleRemove(item.productId, item.variantId)}
                          className="text-sm text-red-600 hover:text-red-700 font-medium mt-1 inline-flex items-center gap-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Order Summary Sidebar */}
        <div className="lg:col-span-1">
          <Card className="sticky top-20">
            <CardHeader className="bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900">Order Summary</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 py-4">
                <div className="flex justify-between text-base">
                  <span className="text-gray-600">Items ({totalItems})</span>
                  <span className="font-medium text-gray-900">{totalPoints.toLocaleString()} pts</span>
                </div>
                <div className="flex justify-between text-base">
                  <span className="text-gray-600">Shipping</span>
                  <span className="font-medium text-green-600">FREE</span>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <div className="flex justify-between items-baseline mb-6">
                  <span className="text-lg font-semibold text-gray-900">Total</span>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-secondary">
                      {totalPoints.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-500">points</p>
                  </div>
                </div>

                <Link href="/checkout" className="block mb-3">
                  <Button variant="primary" className="w-full h-12 text-base font-semibold">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Proceed to Checkout
                  </Button>
                </Link>
                
                <Link href="/dashboard" className="block">
                  <Button variant="outline" className="w-full">
                    Continue Shopping
                  </Button>
                </Link>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-start gap-2 text-sm text-gray-600">
                  <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <p>Secure checkout with no payment required. Points only!</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

