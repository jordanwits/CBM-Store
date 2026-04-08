'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardContent } from 'core/components/Card';
import { PageHeader } from 'core/components/PageHeader';
import { Alert } from 'core/components/Alert';
import { Skeleton } from 'core/components/Skeleton';
import { BackButton } from 'core/components/BackButton';
import { Button } from 'core/components/Button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getCart, clearCart } from '@/lib/cart/storage';
import type { CartItemWithDetails } from '@/lib/cart/types';
import Image from 'next/image';
import { getCheckoutData } from './actions';
import { allocateCheckoutSpend, isAffinityProduct } from '@/lib/points/buckets';

interface CheckoutPageClientProps {
  isDevMode: boolean;
  placeOrder: (formData: FormData) => Promise<{ success: boolean; orderId?: string; error?: string }>;
}

const mockProducts = [
  { id: '1', name: 'Company Logo T-Shirt', base_usd: 25.0, images: ['/ChrisCrossBlackCottonT-Shirt.webp'], collections: ['Affinity', 'Essentials'] },
  { id: '2', name: 'Insulated Water Bottle', base_usd: 35.0, images: ['/KiyoUVC-Bottle_Studio_Fullsize-500ml_Black_C2_4480x.jpg'], collections: [] },
  { id: '3', name: 'Laptop Backpack', base_usd: 75.0, images: ['/1200W-18684-Black-0-NKDH7709BlackBagFront3.jpg'], collections: [] },
  { id: '4', name: 'Wireless Mouse', base_usd: 45.0, images: ['/b43457a0-76b6-11f0-9faf-5258f188704a.png'], collections: [] },
  { id: '5', name: 'Notebook Set', base_usd: 20.0, images: ['/moleskine-classic-hardcover-notebook-black.webp'], collections: [] },
];

export default function CheckoutPageClient({
  isDevMode,
  placeOrder,
}: CheckoutPageClientProps) {
  const router = useRouter();
  const [cartItems, setCartItems] = useState<CartItemWithDetails[]>([]);
  const [pointsBalance, setPointsBalance] = useState(0);
  const [universalBalance, setUniversalBalance] = useState(0);
  const [restrictedBalance, setRestrictedBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCart = useCallback(async () => {
    const cart = getCart();

    if (cart.items.length === 0) {
      router.push('/cart');
      return;
    }

    let products: any[] = [];
    let variants: any[] = [];
    let conversionRate = 100;
    let balance = 2500;
    let universal = 2000;
    let restricted = 500;

    if (isDevMode) {
      products = mockProducts;
    } else {
      const data = await getCheckoutData(cart.items);
      products = data.products;
      variants = data.variants;
      conversionRate = data.conversionRate;
      balance = data.pointsBalance;
      universal = data.universalBalance;
      restricted = data.restrictedBalance;
    }

    setPointsBalance(balance);
    setUniversalBalance(universal);
    setRestrictedBalance(restricted);

    const enriched: CartItemWithDetails[] = cart.items.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      const variant = item.variantId
        ? variants.find((v) => v.id === item.variantId)
        : undefined;

      if (!product) {
      return {
        ...item,
        productName: 'Unknown Product',
        pointsPerItem: 0,
        totalPoints: 0,
        affinityEligible: false,
      };
    }

    const basePoints = Math.round(product.base_usd * conversionRate);
      const variantAdjustment = variant
        ? Math.round(Number(variant.price_adjustment_usd ?? 0) * conversionRate)
        : 0;
    const pointsPerItem = basePoints + variantAdjustment;
    const affinityEligible = isAffinityProduct(product.collections);

    return {
      ...item,
      productName: product.name,
      variantName: variant?.name,
      pointsPerItem,
      totalPoints: pointsPerItem * item.quantity,
      imageUrl: product.images?.[0],
      affinityEligible,
    };
    });

    setCartItems(enriched);
    setIsLoading(false);
  }, [isDevMode, router]);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  const totalPoints = cartItems.reduce((sum, item) => sum + item.totalPoints, 0);
  const eligiblePoints = cartItems.reduce(
    (sum, item) => sum + (item.affinityEligible ? item.totalPoints : 0),
    0
  );
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const spendPlan = allocateCheckoutSpend(
    totalPoints,
    eligiblePoints,
    restrictedBalance,
    universalBalance
  );
  const hasInsufficientPoints = !spendPlan.canAfford;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isDevMode) {
      setError('Order placement requires Supabase to be configured. Please set up your Supabase project and credentials.');
      return;
    }

    if (hasInsufficientPoints) {
      setError(
        'Insufficient points for this order. CBM points apply to Affinity-tagged items first; universal points cover the rest.'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('cart', JSON.stringify(getCart()));

      const result = await placeOrder(formData);

      if (result.success && result.orderId) {
        clearCart();
        router.push(`/orders/${result.orderId}`);
      } else {
        setError(result.error || 'Failed to place order. Please try again.');
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Checkout" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton height={300} />
            <Skeleton height={200} />
          </div>
          <div>
            <Skeleton height={400} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <BackButton href="/cart" label="Back to Cart" className="mb-4" />
      <PageHeader
        title="Checkout"
        subtitle="Review your order — all items are store pickup"
      />

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader className="bg-gray-50">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <h2 className="text-lg font-semibold text-gray-900">Store pickup</h2>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700">
                  You will pick up your order at our location.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="bg-gray-50">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                  <h2 className="text-lg font-semibold text-gray-900">Order items ({totalItems})</h2>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {cartItems.map((item) => (
                    <div
                      key={`${item.productId}-${item.variantId || 'default'}`}
                      className="flex gap-3 py-3 border-b last:border-0"
                    >
                      <div className="w-16 h-16 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                        {item.imageUrl ? (
                          <Image
                            src={item.imageUrl}
                            alt={item.productName}
                            width={64}
                            height={64}
                            className="object-cover object-[center_30%] w-full h-full"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">
                            No Image
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{item.productName}</p>
                        {item.variantName && (
                          <p className="text-sm text-gray-600">{item.variantName}</p>
                        )}
                        <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                        {item.affinityEligible && (
                          <p className="text-xs text-primary font-medium mt-0.5">
                            Affinity — CBM points apply first
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">{item.totalPoints} pts</p>
                        <p className="text-xs text-gray-500">{item.pointsPerItem} pts each</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card className="sticky top-20">
              <CardHeader className="bg-gray-50">
                <h2 className="text-lg font-semibold text-gray-900">Order summary</h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className={`p-4 rounded-lg border-2 ${
                  hasInsufficientPoints
                    ? 'bg-red-50 border-red-200'
                    : 'bg-blue-50 border-blue-200'
                }`}>
                  <div className="space-y-1 mb-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-700">Universal balance</span>
                      <span className="font-bold text-gray-900">{universalBalance.toLocaleString()} pts</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-700">CBM points balance</span>
                      <span className="font-bold text-gray-900">{restrictedBalance.toLocaleString()} pts</span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-blue-200/80">
                      <span className="text-xs text-gray-600">Total across buckets</span>
                      <span className="text-sm font-semibold text-gray-800">{pointsBalance.toLocaleString()} pts</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Order total</span>
                    <span className="text-xl font-bold text-gray-900">
                      {totalPoints.toLocaleString()} pts
                    </span>
                  </div>
                  {eligiblePoints > 0 && (
                    <p className="text-xs text-gray-600 mb-2">
                      Affinity-eligible in cart: {eligiblePoints.toLocaleString()} pts (CBM points apply here first)
                    </p>
                  )}
                  {!hasInsufficientPoints && (
                    <div className="text-xs text-gray-700 space-y-0.5 mb-2">
                      <p>
                        This order will use{' '}
                        <strong>{spendPlan.restrictedSpend.toLocaleString()}</strong> CBM points +{' '}
                        <strong>{spendPlan.universalSpend.toLocaleString()}</strong> universal pts
                      </p>
                    </div>
                  )}
                  {hasInsufficientPoints && (
                    <div className="mt-3 pt-3 border-t border-red-300">
                      <p className="text-sm font-semibold text-red-800">Insufficient points</p>
                      <p className="text-xs text-red-700 mt-1">
                        Adjust your cart or earn more points. Universal shortfall:{' '}
                        {Math.max(0, spendPlan.universalSpend - universalBalance).toLocaleString()} pts
                      </p>
                    </div>
                  )}
                  {!hasInsufficientPoints && (
                    <div className="mt-3 pt-3 border-t border-secondary/30">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">After purchase (est.)</span>
                        <span className="text-lg font-bold text-primary">
                          {(pointsBalance - totalPoints).toLocaleString()} pts total
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        Universal: {(universalBalance - spendPlan.universalSpend).toLocaleString()} · CBM points:{' '}
                        {(restrictedBalance - spendPlan.restrictedSpend).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2 py-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Items ({totalItems})</span>
                    <span className="font-semibold text-gray-900">{totalPoints.toLocaleString()} pts</span>
                  </div>
                </div>

                {error && (
                  <Alert variant="error" className="mb-4">
                    {error}
                  </Alert>
                )}

                {isDevMode && (
                  <Alert variant="warning" className="mb-4">
                    <p className="text-xs">
                      <strong>Dev mode:</strong> Order placement requires Supabase configuration
                    </p>
                  </Alert>
                )}

                <div className="space-y-3 pt-4 border-t">
                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full h-12 text-base font-semibold"
                    disabled={isSubmitting || hasInsufficientPoints || isDevMode}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Processing...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Place order ({totalPoints.toLocaleString()} pts)
                      </span>
                    )}
                  </Button>

                  <Link href="/cart" className="block">
                    <Button variant="outline" className="w-full">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                      </svg>
                      Back to cart
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
