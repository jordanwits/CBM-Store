'use client';

import { useState } from 'react';
import { Card, CardContent } from 'core/components/Card';
import { Badge } from 'core/components/Badge';
import AddToCartButton from './AddToCartButton';
import ImageGallery from './ImageGallery';

interface Variant {
  id: string;
  name: string;
  size?: string;
  color?: string;
  price_adjustment_usd: number;
  image_url?: string;
}

interface ProductPageClientProps {
  product: any;
  variants: Variant[];
  basePoints: number;
  conversionRate: number;
}

export default function ProductPageClient({
  product,
  variants,
  basePoints,
  conversionRate,
}: ProductPageClientProps) {
  const [selectedColor, setSelectedColor] = useState<string | undefined>();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
      {/* Product Image Gallery */}
      <ImageGallery 
        images={product.images || []} 
        productName={product.name}
        variants={variants}
        selectedColor={selectedColor}
      />

      {/* Product Info & Purchase Panel */}
      <div className="flex flex-col">
        <div className="mb-6">
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-3">{product.name}</h1>
          
          <div className="flex items-baseline gap-3 mb-4">
            <p className="text-4xl font-bold text-secondary">{basePoints.toLocaleString()}</p>
            <span className="text-lg text-gray-600">points</span>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="secondary">In Stock</Badge>
            <span className="text-sm text-gray-600">• Usually ships within 3-5 business days</span>
          </div>
        </div>

        <Card className="mb-6">
          <CardContent>
            <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Product Details
            </h2>
            <p className="text-gray-700 leading-relaxed">{product.description}</p>
          </CardContent>
        </Card>

        <AddToCartButton
          productId={product.id}
          productName={product.name}
          variants={variants}
          basePoints={basePoints}
          conversionRate={conversionRate}
          onColorChange={setSelectedColor}
        />
      </div>
    </div>
  );
}
