'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardContent } from 'core/components/Card';
import { PageHeader } from 'core/components/PageHeader';
import { Alert } from 'core/components/Alert';
import { Badge } from 'core/components/Badge';
import { Skeleton } from 'core/components/Skeleton';
import { BackButton } from 'core/components/BackButton';
import { Button } from 'core/components/Button';
import { Input } from 'core/components/Input';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getCart, clearCart } from '@/lib/cart/storage';
import type { CartItemWithDetails } from '@/lib/cart/types';
import Image from 'next/image';
import { getCheckoutData } from './actions';

interface CheckoutPageClientProps {
  isDevMode: boolean;
  placeOrder: (formData: FormData) => Promise<{ success: boolean; orderId?: string; error?: string }>;
  profileAddress: {
    fullName: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
}

// Mock data for dev mode
const mockProducts = [
  { id: '1', name: 'Company Logo T-Shirt', base_usd: 25.00, images: ['/ChrisCrossBlackCottonT-Shirt.webp'] },
  { id: '2', name: 'Insulated Water Bottle', base_usd: 35.00, images: ['/KiyoUVC-Bottle_Studio_Fullsize-500ml_Black_C2_4480x.jpg'] },
  { id: '3', name: 'Laptop Backpack', base_usd: 75.00, images: ['/1200W-18684-Black-0-NKDH7709BlackBagFront3.jpg'] },
  { id: '4', name: 'Wireless Mouse', base_usd: 45.00, images: ['/b43457a0-76b6-11f0-9faf-5258f188704a.png'] },
  { id: '5', name: 'Notebook Set', base_usd: 20.00, images: ['/moleskine-classic-hardcover-notebook-black.webp'] },
];

export default function CheckoutPageClient({
  isDevMode,
  placeOrder,
  profileAddress,
}: CheckoutPageClientProps) {
  const router = useRouter();
  const [cartItems, setCartItems] = useState<CartItemWithDetails[]>([]);
  const [pointsBalance, setPointsBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [addressFilled, setAddressFilled] = useState(false);

  // Form state
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'delivery'>('delivery');
  const [shipName, setShipName] = useState('');
  const [shipAddressLine1, setShipAddressLine1] = useState('');
  const [shipAddressLine2, setShipAddressLine2] = useState('');
  const [shipCity, setShipCity] = useState('');
  const [shipState, setShipState] = useState('');
  const [shipZip, setShipZip] = useState('');
  const [shipCountry, setShipCountry] = useState('US');

  // Auto-fill address from profile when delivery method is selected
  useEffect(() => {
    if (deliveryMethod === 'delivery' && profileAddress.addressLine1) {
      // Only auto-fill if fields are empty or if user hasn't manually edited them
      if (!addressFilled) {
        setShipName(profileAddress.fullName || '');
        setShipAddressLine1(profileAddress.addressLine1 || '');
        setShipAddressLine2(profileAddress.addressLine2 || '');
        setShipCity(profileAddress.city || '');
        setShipState(profileAddress.state || '');
        setShipZip(profileAddress.zip || '');
        setShipCountry(profileAddress.country || 'US');
        setAddressFilled(true);
      }
    }
  }, [deliveryMethod, addressFilled, profileAddress]);

  // Function to manually fill from profile
  const fillFromProfile = () => {
    if (profileAddress.addressLine1) {
      setShipName(profileAddress.fullName || '');
      setShipAddressLine1(profileAddress.addressLine1 || '');
      setShipAddressLine2(profileAddress.addressLine2 || '');
      setShipCity(profileAddress.city || '');
      setShipState(profileAddress.state || '');
      setShipZip(profileAddress.zip || '');
      setShipCountry(profileAddress.country || 'US');
    }
  };

  const loadCart = useCallback(async () => {
    const cart = getCart();
    
    if (cart.items.length === 0) {
      router.push('/cart');
      return;
    }

    let products: any[] = [];
    let variants: any[] = [];
    let conversionRate = 100;
    let balance = 2500; // Default for dev mode

    if (isDevMode) {
      products = mockProducts;
    } else {
      // Fetch only the products in the cart via server action - much faster!
      const data = await getCheckoutData(cart.items);
      products = data.products;
      variants = data.variants;
      conversionRate = data.conversionRate;
      balance = data.pointsBalance;
    }

    setPointsBalance(balance);

    // Enrich cart items with product/variant details
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
  }, [isDevMode, router]);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  const totalPoints = cartItems.reduce((sum, item) => sum + item.totalPoints, 0);
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const hasInsufficientPoints = totalPoints > pointsBalance;

  const handleContinueToReview = () => {
    setError(null);

    // Validate shipping fields if delivery is selected
    if (deliveryMethod === 'delivery') {
      if (!shipName || !shipAddressLine1 || !shipCity || !shipState || !shipZip || !shipCountry) {
        setError('All shipping fields are required for delivery orders.');
        return;
      }
    }

    // Proceed to review step
    setCurrentStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isDevMode) {
      setError('Order placement requires Supabase to be configured. Please set up your Supabase project and credentials.');
      return;
    }

    if (hasInsufficientPoints) {
      setError('Insufficient points balance for this order.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare form data
      const formData = new FormData();
      formData.append('cart', JSON.stringify(getCart()));
      formData.append('deliveryMethod', deliveryMethod);
      formData.append('shipName', shipName);
      formData.append('shipAddressLine1', shipAddressLine1);
      formData.append('shipAddressLine2', shipAddressLine2);
      formData.append('shipCity', shipCity);
      formData.append('shipState', shipState);
      formData.append('shipZip', shipZip);
      formData.append('shipCountry', shipCountry);

      const result = await placeOrder(formData);

      if (result.success && result.orderId) {
        // Clear cart and redirect to order page
        clearCart();
        router.push(`/orders/${result.orderId}`);
      } else {
        setError(result.error || 'Failed to place order. Please try again.');
      }
    } catch (err) {
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
        subtitle="Complete your order and redeem your points"
      />

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
          <div className="flex items-center">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold shrink-0 ${
              currentStep === 1 
                ? 'bg-secondary text-secondary-foreground' 
                : 'bg-primary text-white'
            }`}>
              {currentStep > 1 ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                '1'
              )}
            </div>
            <span className={`ml-2 text-xs sm:text-sm font-medium whitespace-nowrap ${
              currentStep === 1 ? 'text-gray-900' : 'text-gray-600'
            }`}>
              <span className="sm:hidden">Delivery</span>
              <span className="hidden sm:inline">Delivery Options</span>
            </span>
          </div>
          <div className={`hidden sm:block w-16 h-0.5 ${currentStep >= 2 ? 'bg-secondary' : 'bg-gray-300'}`} />
          <div className="flex items-center">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold shrink-0 ${
              currentStep === 2 
                ? 'bg-secondary text-secondary-foreground' 
                : 'bg-gray-200 text-gray-600'
            }`}>
              2
            </div>
            <span className={`ml-2 text-xs sm:text-sm font-medium whitespace-nowrap ${
              currentStep === 2 ? 'text-gray-900' : 'text-gray-500'
            }`}>Review</span>
          </div>
          <div className="hidden sm:block w-16 h-0.5 bg-gray-300" />
          <div className="flex items-center">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-200 text-gray-600 font-bold shrink-0">
              3
            </div>
            <span className="ml-2 text-xs sm:text-sm font-medium text-gray-500 whitespace-nowrap">Complete</span>
          </div>
        </div>
      </div>

      <form onSubmit={currentStep === 2 ? handleSubmit : (e) => { e.preventDefault(); handleContinueToReview(); }}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Step 1: Delivery Method and Shipping */}
          {currentStep === 1 && (
            <div className="lg:col-span-2 space-y-6">
              <Card>
              <CardHeader className="bg-gray-50">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  <h2 className="text-lg font-semibold text-gray-900">Delivery Method</h2>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        setDeliveryMethod('pickup');
                        setAddressFilled(false); // Reset so address can auto-fill again if they switch back
                      }}
                      className={`p-4 border-2 rounded-lg text-left transition-all ${
                        deliveryMethod === 'pickup'
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                          deliveryMethod === 'pickup'
                            ? 'border-primary bg-primary'
                            : 'border-gray-300'
                        }`}>
                          {deliveryMethod === 'pickup' && (
                            <div className="w-2 h-2 rounded-full bg-white" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <h3 className="font-semibold text-gray-900">Pickup</h3>
                          </div>
                          <p className="text-sm text-gray-600">Pick up your order at our location</p>
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setDeliveryMethod('delivery');
                        // Reset addressFilled so it can auto-fill when switching to delivery
                        setAddressFilled(false);
                      }}
                      className={`p-4 border-2 rounded-lg text-left transition-all ${
                        deliveryMethod === 'delivery'
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                          deliveryMethod === 'delivery'
                            ? 'border-primary bg-primary'
                            : 'border-gray-300'
                        }`}>
                          {deliveryMethod === 'delivery' && (
                            <div className="w-2 h-2 rounded-full bg-white" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                            </svg>
                            <h3 className="font-semibold text-gray-900">Delivery</h3>
                          </div>
                          <p className="text-sm text-gray-600">Ship to your address</p>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Shipping Information - Only show for delivery */}
            {deliveryMethod === 'delivery' && (
              <Card>
                <CardHeader className="bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <h2 className="text-lg font-semibold text-gray-900">Shipping Information</h2>
                    </div>
                    {profileAddress.addressLine1 && (
                      <button
                        type="button"
                        onClick={fillFromProfile}
                        className="text-sm text-gray-900 hover:text-gray-700 font-medium underline"
                      >
                        Use Default Address
                      </button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="shipName" className="block text-sm font-medium text-gray-900 mb-1">
                        Full Name *
                      </label>
                      <Input
                        id="shipName"
                        type="text"
                        required={deliveryMethod === 'delivery'}
                        value={shipName}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShipName(e.target.value)}
                        placeholder="John Doe"
                      />
                    </div>

                    <div>
                      <label htmlFor="shipAddressLine1" className="block text-sm font-medium text-gray-900 mb-1">
                        Address Line 1 *
                      </label>
                      <Input
                        id="shipAddressLine1"
                        type="text"
                        required={deliveryMethod === 'delivery'}
                        value={shipAddressLine1}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShipAddressLine1(e.target.value)}
                        placeholder="123 Main St"
                      />
                    </div>

                    <div>
                      <label htmlFor="shipAddressLine2" className="block text-sm font-medium text-gray-900 mb-1">
                        Address Line 2
                      </label>
                      <Input
                        id="shipAddressLine2"
                        type="text"
                        value={shipAddressLine2}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShipAddressLine2(e.target.value)}
                        placeholder="Apt 4B"
                        className="placeholder:text-gray-400"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="shipCity" className="block text-sm font-medium text-gray-900 mb-1">
                          City *
                        </label>
                        <Input
                          id="shipCity"
                          type="text"
                          required={deliveryMethod === 'delivery'}
                          value={shipCity}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShipCity(e.target.value)}
                          placeholder="New York"
                        />
                      </div>

                      <div>
                        <label htmlFor="shipState" className="block text-sm font-medium text-gray-900 mb-1">
                          State *
                        </label>
                        <Input
                          id="shipState"
                          type="text"
                          required={deliveryMethod === 'delivery'}
                          value={shipState}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShipState(e.target.value)}
                          placeholder="NY"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="shipZip" className="block text-sm font-medium text-gray-900 mb-1">
                          ZIP Code *
                        </label>
                        <Input
                          id="shipZip"
                          type="text"
                          required={deliveryMethod === 'delivery'}
                          value={shipZip}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShipZip(e.target.value)}
                          placeholder="10001"
                        />
                      </div>

                      <div>
                        <label htmlFor="shipCountry" className="block text-sm font-medium text-gray-900 mb-1">
                          Country *
                        </label>
                        <Input
                          id="shipCountry"
                          type="text"
                          required={deliveryMethod === 'delivery'}
                          value={shipCountry}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShipCountry(e.target.value)}
                          placeholder="US"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            </div>
          )}

          {/* Step 2: Review */}
          {currentStep === 2 && (
            <div className="lg:col-span-2 space-y-6">
              {/* Delivery Information Summary */}
              <Card>
                <CardHeader className="bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <h2 className="text-lg font-semibold text-gray-900">Delivery Information</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setCurrentStep(1); setError(null); }}
                      className="text-sm text-secondary hover:text-secondary/80 font-medium underline"
                    >
                      Edit
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-1">Delivery Method</p>
                      <p className="text-base text-gray-900 flex items-center gap-2">
                        {deliveryMethod === 'pickup' ? (
                          <>
                            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Pickup at store location
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                            </svg>
                            Delivery to address
                          </>
                        )}
                      </p>
                    </div>

                    {deliveryMethod === 'delivery' && (
                      <div className="pt-3 border-t">
                        <p className="text-sm font-semibold text-gray-700 mb-2">Shipping Address</p>
                        <div className="text-base text-gray-900 space-y-1">
                          <p>{shipName}</p>
                          <p>{shipAddressLine1}</p>
                          {shipAddressLine2 && <p>{shipAddressLine2}</p>}
                          <p>{shipCity}, {shipState} {shipZip}</p>
                          <p>{shipCountry}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Order Items */}
              <Card>
              <CardHeader className="bg-gray-50">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                  <h2 className="text-lg font-semibold text-gray-900">Order Items ({totalItems})</h2>
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
          )}

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-20">
              <CardHeader className="bg-gray-50">
                <h2 className="text-lg font-semibold text-gray-900">Order Summary</h2>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Points Balance Card */}
                <div className={`p-4 rounded-lg border-2 ${
                  hasInsufficientPoints 
                    ? 'bg-red-50 border-red-200' 
                    : 'bg-blue-50 border-blue-200'
                }`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Your Balance</span>
                    <span className="text-xl font-bold text-gray-900">
                      {pointsBalance.toLocaleString()} pts
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Order Total</span>
                    <span className="text-xl font-bold text-gray-900">
                      {totalPoints.toLocaleString()} pts
                    </span>
                  </div>
                  {hasInsufficientPoints && (
                    <div className="mt-3 pt-3 border-t border-red-300">
                      <p className="text-sm font-semibold text-red-800">Insufficient Points</p>
                      <p className="text-xs text-red-700 mt-1">
                        You need {(totalPoints - pointsBalance).toLocaleString()} more points to complete this order
                      </p>
                    </div>
                  )}
                  {!hasInsufficientPoints && (
                    <div className="mt-3 pt-3 border-t border-secondary/30">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">After Purchase</span>
                        <span className="text-lg font-bold text-primary">
                          {(pointsBalance - totalPoints).toLocaleString()} pts
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Order Breakdown */}
                <div className="space-y-2 py-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Items ({totalItems})</span>
                    <span className="font-semibold text-gray-900">{totalPoints.toLocaleString()} pts</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Shipping</span>
                    <Badge variant="success" size="sm">FREE</Badge>
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
                      <strong>Dev Mode:</strong> Order placement requires Supabase configuration
                    </p>
                  </Alert>
                )}

                {/* Action Buttons */}
                <div className="space-y-3 pt-4 border-t">
                  {currentStep === 1 ? (
                    <>
                      <Button
                        type="submit"
                        variant="primary"
                        className="w-full h-12 text-base font-semibold"
                      >
                        <span className="flex items-center justify-center gap-2">
                          Continue to Review
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </span>
                      </Button>

                      <Link href="/cart" className="block">
                        <Button variant="outline" className="w-full">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                          </svg>
                          Back to Cart
                        </Button>
                      </Link>
                    </>
                  ) : (
                    <>
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
                            Place Order ({totalPoints.toLocaleString()} pts)
                          </span>
                        )}
                      </Button>

                      <Button
                        type="button"
                        onClick={() => { setCurrentStep(1); setError(null); }}
                        variant="outline"
                        className="w-full"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to Delivery Options
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}

