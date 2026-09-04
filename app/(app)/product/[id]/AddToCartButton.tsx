'use client';

import { useState } from 'react';
import { Button } from 'core/components/Button';
import { Card, CardContent } from 'core/components/Card';
import { Alert } from 'core/components/Alert';
import Link from 'next/link';
import { addToCart } from '@/lib/cart/storage';
import { availabilityPillClasses, variantAvailability } from '@/lib/inventory/availability';

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
  /** Null is an untracked variant, which is not the same as a count of 0. */
  inventory_count?: number | null;
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
    // A size the product isn't made in for this colour cannot stay selected: the pair would
    // match no variant at all, and an unmatched pair is what used to reach the cart as a
    // bare product line with no colour, no price adjustment and the cover photo.
    if (selectedSize && !variants.some((v) => v.color === color && v.size === selectedSize)) {
      setSelectedSize(undefined);
    }
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

  /**
   * Whether the product is made in this size in the colour currently chosen. A shirt can
   * come in Green in S and M only, and every size looked equally pickable, so Green + L was
   * a dead end the page never mentioned. Sizes are gated by colour rather than the other way
   * round because the colour picker sits first; colours stay clickable so a customer can
   * always change their mind without getting stuck.
   */
  const isSizeOffered = (size: string) =>
    !hasColors || !selectedColor
      ? true
      : variants.some((v) => v.size === size && v.color === selectedColor);

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

  // What the store can say about this exact combination at this exact quantity. Null until
  // something is selected, since there is nothing specific to describe yet: the product-level
  // badge above covers that case.
  const availability = selectedVariant
    ? variantAvailability(selectedVariant, madeToOrder, quantity)
    : null;

  const isOutOfStock = availability?.state === 'out_of_stock';

  // Every dimension the product offers has a selection
  const dimensionsSatisfied =
    (hasColors || hasSizes) &&
    (!hasColors || !!selectedColor) &&
    (!hasSizes || !!selectedSize);

  // A quantity the shelf cannot cover is rejected by place_points_order, so it is stopped
  // here rather than at the end of checkout. Made-to-order lines always pass: running out
  // means the rest gets made.
  // The variant itself has to resolve, not just the dimensions. Satisfying every dimension
  // proves a colour and a size were picked, never that the product is made in that pair, and
  // adding an unresolved pair puts a line in the cart with no variant on it.
  const canAddToCart =
    !hasVariants ||
    ((hasOptions ? !!selectedOption || dimensionsSatisfied : dimensionsSatisfied) &&
      !!selectedVariant &&
      (availability?.sufficient ?? true));

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
    if (availability && !availability.sufficient) {
      return `Only ${availability.unitsOnHand} left`;
    }
    if (dimensionsSatisfied && !selectedVariant) {
      return selectedColor && selectedSize
        ? `${selectedSize} does not come in ${selectedColor}`
        : 'That combination is not available';
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
              const offered = isSizeOffered(size);

              return (
                <button
                  key={size}
                  onClick={() => handleSizeChange(size)}
                  disabled={!offered}
                  className={`relative h-12 min-w-[3rem] px-3 rounded-full border-2 transition-all flex items-center justify-center ${
                    isSelected
                      ? 'border-primary bg-primary text-white shadow-lg scale-110'
                      : offered
                      ? 'border-gray-400 hover:border-gray-600 bg-white text-gray-900'
                      : 'border-gray-200 bg-gray-50 text-gray-400 line-through cursor-not-allowed'
                  }`}
                  title={offered ? size : `${size} does not come in ${selectedColor}`}
                  aria-label={offered ? size : `${size}, not available in ${selectedColor}`}
                >
                  <span
                    className={`font-semibold text-sm ${
                      isSelected ? 'text-white' : offered ? 'text-gray-900' : 'text-gray-400'
                    }`}
                  >
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
        {availability && availability.state !== 'in_stock' && (
          <div className="rounded-md bg-gray-50 border border-gray-200 p-3">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${availabilityPillClasses(
                availability.tone
              )}`}
            >
              {availability.label}
            </span>
            {availability.detail && (
              <p className="text-sm text-gray-700 mt-1.5">
                {availability.detail}
                {availability.state === 'made_to_order' &&
                  ' See the product details for lead time.'}
              </p>
            )}
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
