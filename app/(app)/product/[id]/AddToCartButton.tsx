'use client';

import { useState } from 'react';
import { Button } from 'core/components/Button';
import { Card, CardContent } from 'core/components/Card';
import { Alert } from 'core/components/Alert';
import Link from 'next/link';
import { addToCart } from '@/lib/cart/storage';

// Map color names to CSS colors
const colorMap: Record<string, string> = {
  'Black': '#000000',
  'White': '#FFFFFF',
  'Blue': '#3B82F6',
  'Red': '#EF4444',
  'Green': '#10B981',
  'Yellow': '#FBBF24',
  'Purple': '#A855F7',
  'Pink': '#EC4899',
  'Gray': '#6B7280',
  'Grey': '#6B7280',
  'Silver': '#C0C0C0',
  'Gold': '#FFD700',
  'Orange': '#F97316',
  'Navy': '#1E3A8A',
  'Brown': '#92400E',
};

interface Variant {
  id: string;
  name: string;
  size?: string;
  color?: string;
  price_adjustment_usd: number;
  inventory_count?: number;
  image_url?: string;
}

interface AddToCartButtonProps {
  productId: string;
  productName: string;
  variants: Variant[];
  basePoints: number;
  conversionRate: number;
  madeToOrder?: boolean;
  onColorChange?: (color: string | undefined) => void;
}

export default function AddToCartButton({
  productId,
  productName,
  variants,
  basePoints,
  conversionRate,
  madeToOrder = false,
  onColorChange,
}: AddToCartButtonProps) {
  const [selectedColor, setSelectedColor] = useState<string | undefined>();
  const [selectedSize, setSelectedSize] = useState<string | undefined>();
  const [selectedOption, setSelectedOption] = useState<string | undefined>();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  // Notify parent when color changes
  const handleColorChange = (color: string) => {
    setSelectedColor(color);
    setSelectedOption(undefined);
    if (onColorChange) {
      onColorChange(color);
    }
  };

  const handleSizeChange = (size: string) => {
    setSelectedSize(size);
    setSelectedOption(undefined);
  };

  // Custom variants are standalone, so picking one clears any size/color choice
  const handleOptionChange = (option: string) => {
    setSelectedOption(option);
    setSelectedSize(undefined);
    setSelectedColor(undefined);
    if (onColorChange) {
      onColorChange(undefined);
    }
  };

  const hasVariants = variants && variants.length > 0;

  // Extract unique colors and sizes
  const availableColors = hasVariants
    ? Array.from(new Set(variants.filter(v => v.color).map(v => v.color!)))
    : [];
  const availableSizes = hasVariants
    ? Array.from(new Set(variants.filter(v => v.size).map(v => v.size!)))
    : [];
  // Custom variants carry neither a size nor a color — they're picked by name
  const optionVariants = hasVariants
    ? variants.filter(v => !v.size && !v.color)
    : [];

  const hasColors = availableColors.length > 0;
  const hasSizes = availableSizes.length > 0;
  const hasOptions = optionVariants.length > 0;

  // Find the matching variant combination
  const selectedVariant = selectedOption
    ? optionVariants.find(v => v.name === selectedOption)
    : hasVariants
    ? variants.find(v => {
        // For combination variants (both size and color exist in DB)
        if (hasColors && hasSizes) {
          return v.size === selectedSize && v.color === selectedColor;
        }
        // For single-dimension variants
        if (hasColors && !hasSizes) {
          return v.color === selectedColor;
        }
        if (hasSizes && !hasColors) {
          return v.size === selectedSize;
        }
        return false;
      })
    : undefined;

  const selectedVariantId = selectedVariant?.id;
  
  // Check if selected combination is in stock. Made-to-order products are procured
  // per order, so stock never gates them.
  const isOutOfStock = !madeToOrder &&
    selectedVariant &&
    selectedVariant.inventory_count !== null &&
    selectedVariant.inventory_count !== undefined &&
    selectedVariant.inventory_count < 1;
  
  // Every dimension the product offers has a selection
  const dimensionsSatisfied =
    (hasColors || hasSizes) &&
    (!hasColors || !!selectedColor) &&
    (!hasSizes || !!selectedSize);

  const canAddToCart =
    !hasVariants ||
    ((hasOptions ? !!selectedOption || dimensionsSatisfied : dimensionsSatisfied) &&
      !isOutOfStock);

  const handleAddToCart = () => {
    if (!canAddToCart) return;

    addToCart(productId, selectedVariantId, quantity);
    setAdded(true);

    // Reset after 3 seconds
    setTimeout(() => {
      setAdded(false);
    }, 3000);
  };

  // Calculate final points including variant adjustment
  const variantAdjustment = selectedVariant 
    ? Math.round(selectedVariant.price_adjustment_usd * conversionRate) 
    : 0;
  const finalPoints = basePoints + variantAdjustment;
  
  // Get availability message
  const getAvailabilityMessage = () => {
    if (isOutOfStock) {
      return 'This combination is out of stock';
    }
    if (!canAddToCart && hasColors && !selectedColor) {
      return 'Please select a color';
    }
    if (!canAddToCart && hasSizes && !selectedSize) {
      return 'Please select a size';
    }
    if (!canAddToCart && hasOptions && !selectedOption) {
      return 'Please select an option';
    }
    return '';
  };

  if (added) {
    return (
      <Alert variant="success" className="mb-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="font-semibold mb-1">Added to cart!</p>
            <p className="text-sm">
              {quantity} {quantity === 1 ? 'item' : 'items'} added • {finalPoints * quantity} points
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Link href="/cart">
              <Button variant="primary" size="sm">
                View Cart
              </Button>
            </Link>
            <Button variant="secondary" size="sm" onClick={() => setAdded(false)}>
              Continue
            </Button>
          </div>
        </div>
      </Alert>
    );
  }

  return (
    <div className="space-y-5">
      {/* Color Selection */}
      {hasColors && (
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-3">
            Color {!selectedColor && !selectedOption && <span className="text-red-500">*</span>}
          </label>
          <div className="flex flex-wrap gap-3">
            {availableColors.map((color) => {
              const isSelected = selectedColor === color;
              const bgColor = colorMap[color];
              const needsBorder = color === 'White' || color === 'Silver' || color === 'Yellow';

              // Custom colors have no swatch to show, so label them instead
              if (!bgColor) {
                return (
                  <button
                    key={color}
                    onClick={() => handleColorChange(color)}
                    className={`px-4 h-12 rounded-full border-2 transition-all font-semibold text-sm ${
                      isSelected
                        ? 'border-primary bg-primary text-white shadow-lg scale-105'
                        : 'border-gray-400 hover:border-gray-600 bg-white text-gray-900'
                    }`}
                    title={color}
                    aria-label={color}
                  >
                    {color}
                  </button>
                );
              }

              return (
                <button
                  key={color}
                  onClick={() => handleColorChange(color)}
                  className={`relative w-12 h-12 rounded-full transition-all ${
                    isSelected ? 'ring-4 ring-primary ring-offset-2 scale-110' : 'hover:scale-105'
                  } ${needsBorder ? 'border-2 border-gray-300' : ''}`}
                  style={{ backgroundColor: bgColor }}
                  title={color}
                  aria-label={color}
                >
                  {isSelected && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center border-2 border-white shadow-lg">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Size Selection */}
      {hasSizes && (
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-3">
            Size {!selectedSize && !selectedOption && <span className="text-red-500">*</span>}
          </label>
          <div className="flex flex-wrap gap-3">
            {availableSizes.map((size) => {
              const isSelected = selectedSize === size;
              
              return (
                <button
                  key={size}
                  onClick={() => handleSizeChange(size)}
                  className={`relative h-12 min-w-[3rem] px-3 rounded-full border-2 transition-all flex items-center justify-center ${
                    isSelected
                      ? 'border-primary bg-primary text-white shadow-lg scale-110'
                      : 'border-gray-400 hover:border-gray-600 bg-white text-gray-900'
                  }`}
                  title={size}
                  aria-label={size}
                >
                  <span className={`font-semibold text-sm ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                    {size}
                  </span>
                  {isSelected && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center border-2 border-white shadow-lg">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Custom Variant Selection */}
      {hasOptions && (
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-3">
            Options {!selectedOption && (hasColors || hasSizes ? null : <span className="text-red-500">*</span>)}
          </label>
          <div className="flex flex-wrap gap-3">
            {optionVariants.map((variant) => {
              const isSelected = selectedOption === variant.name;

              return (
                <button
                  key={variant.id}
                  onClick={() => handleOptionChange(variant.name)}
                  className={`px-4 h-12 rounded-full border-2 transition-all font-semibold text-sm ${
                    isSelected
                      ? 'border-primary bg-primary text-white shadow-lg scale-105'
                      : 'border-gray-400 hover:border-gray-600 bg-white text-gray-900'
                  }`}
                  title={variant.name}
                  aria-label={variant.name}
                >
                  {variant.name}
                </button>
              );
            })}
          </div>
          {(hasColors || hasSizes) && (
            <p className="text-xs text-gray-600 mt-2">
              Choosing an option replaces your size and color selection
            </p>
          )}
        </div>
      )}

      {/* Quantity Selector */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-3">Quantity</label>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="w-12 h-12 rounded-lg border-2 border-gray-400 hover:border-primary hover:bg-primary/10 flex items-center justify-center font-bold text-xl text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:border-gray-300"
            disabled={quantity <= 1}
            aria-label="Decrease quantity"
          >
            −
          </button>
          <span className="w-20 text-center font-bold text-2xl text-gray-900">{quantity}</span>
          <button
            onClick={() => setQuantity(quantity + 1)}
            className="w-12 h-12 rounded-lg border-2 border-gray-400 hover:border-primary hover:bg-primary/10 flex items-center justify-center font-bold text-xl text-gray-900 transition-colors"
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>
      </div>

      {/* Price Summary & Add to Cart */}
      <div className="pt-4 border-t space-y-4">
        {madeToOrder && (
          <div className="rounded-md bg-primary/5 border border-primary/20 p-3">
            <p className="text-sm font-semibold text-gray-900">Made to order</p>
            <p className="text-sm text-gray-700 mt-0.5">
              This item isn't kept in stock — we'll order it once you place your order. See the
              product details for lead time.
            </p>
          </div>
        )}

        <div className="flex justify-between items-center">
          <span className="text-base font-medium text-gray-700">Subtotal ({quantity} {quantity === 1 ? 'item' : 'items'})</span>
          <span className="text-3xl font-bold text-primary">
            {(finalPoints * quantity).toLocaleString()} <span className="text-lg">pts</span>
          </span>
        </div>
        
        <Button
          variant="primary"
          className="w-full h-14 text-lg font-semibold"
          onClick={handleAddToCart}
          disabled={!canAddToCart}
        >
          {isOutOfStock ? (
            <span className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Out of Stock
            </span>
          ) : !canAddToCart ? (
            <span className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {getAvailabilityMessage()}
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Add to Cart
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
