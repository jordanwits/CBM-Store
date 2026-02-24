'use client';

import Image from 'next/image';
import { useState, useEffect, useMemo } from 'react';

interface Variant {
  id: string;
  color?: string;
  image_url?: string;
}

interface ImageGalleryProps {
  images: string[];
  productName: string;
  variants?: Variant[];
  selectedColor?: string;
}

export default function ImageGallery({ images, productName, variants = [], selectedColor }: ImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  // Build complete image array - when color variants have images, use ONLY one per color (no duplicates)
  const allImages = useMemo(() => {
    const colorVariantsWithImages = variants.filter(v => v.color && v.image_url);
    
    // If we have color variants with images, use ONLY those (one per color) - avoids product + variant duplicate images
    if (colorVariantsWithImages.length > 0) {
      const seen = new Set<string>();
      const result: string[] = [];
      for (const v of colorVariantsWithImages) {
        if (v.image_url && !seen.has(v.color!)) {
          seen.add(v.color!);
          result.push(v.image_url);
        }
      }
      return result;
    }
    
    // No color variant images - use product images
    return [...images];
  }, [images, variants]);

  // When color changes, switch to that color's image
  // Only runs when selectedColor changes, not when navigating with arrows
  useEffect(() => {
    if (selectedColor && variants.length > 0) {
      const colorVariant = variants.find(v => v.color === selectedColor && v.image_url);
      if (colorVariant && colorVariant.image_url) {
        const imageIndex = allImages.indexOf(colorVariant.image_url);
        if (imageIndex >= 0) {
          setSelectedIndex(imageIndex);
        }
      } else if (images.length > 0) {
        // No specific image for this color, go back to first product image
        setSelectedIndex(0);
      }
    } else if (!selectedColor && images.length > 0) {
      // When color is cleared, go back to first product image
      setSelectedIndex(0);
    }
  }, [selectedColor, allImages, variants, images.length]); // allImages is memoized, so this is stable

  if (!allImages || allImages.length === 0) {
    return (
      <div className="space-y-4">
        <div className="aspect-square relative bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl overflow-hidden shadow-lg">
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-24 h-24 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  const handlePrevious = () => {
    setSelectedIndex((prev) => (prev === 0 ? allImages.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setSelectedIndex((prev) => (prev === allImages.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="space-y-4">
      {/* Main Image Display */}
      <div className="aspect-square relative bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl overflow-hidden shadow-lg group">
        <Image
          src={allImages[selectedIndex]}
          alt={`${productName} - Image ${selectedIndex + 1}`}
          fill
          className="object-cover object-[center_30%]"
          priority={selectedIndex === 0}
        />
        
        {/* Navigation Arrows - Only show if there are multiple images */}
        {allImages.length > 1 && (
          <>
            <button
              onClick={handlePrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-800 rounded-full p-3 shadow-lg opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="Previous image"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={handleNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-800 rounded-full p-3 shadow-lg opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="Next image"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Image Counter */}
            <div className="absolute bottom-4 right-4 bg-black/60 text-white px-3 py-1 rounded-full text-sm font-medium">
              {selectedIndex + 1} / {allImages.length}
            </div>
          </>
        )}
      </div>

      {/* Thumbnail Gallery - Only show if there are multiple images */}
      {allImages.length > 1 && (
        <div className="grid grid-cols-4 gap-3">
          {allImages.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedIndex(idx)}
              className={`aspect-square relative bg-gray-100 rounded-lg overflow-hidden cursor-pointer transition-all focus:outline-none ${
                selectedIndex === idx
                  ? 'ring-4 ring-primary shadow-md scale-95'
                  : 'hover:ring-2 hover:ring-gray-300 hover:scale-105'
              }`}
              aria-label={`View image ${idx + 1}`}
            >
              <Image
                src={img}
                alt={`${productName} thumbnail ${idx + 1}`}
                fill
                className="object-cover object-[center_30%]"
              />
              {selectedIndex === idx && (
                <div className="absolute inset-0 bg-primary/10 pointer-events-none" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
