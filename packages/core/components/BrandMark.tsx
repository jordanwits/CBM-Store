'use client';

import React from 'react';
import Image from 'next/image';
import { useBranding } from './BrandingProvider';

interface BrandMarkProps {
  showText?: boolean;
  className?: string;
  textClassName?: string;
  imageClassName?: string;
}

export function BrandMark({ 
  showText = true, 
  className = '',
  textClassName = 'text-xl font-bold',
  imageClassName = ''
}: BrandMarkProps) {
  const branding = useBranding();

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {branding.logo ? (
        <Image
          src={branding.logo.src}
          alt={branding.logo.alt}
          width={branding.logo.width || 40}
          height={branding.logo.height || 40}
          className={imageClassName}
          quality={85}
          priority
          loading="eager"
        />
      ) : null}
      {showText && (
        <span className={textClassName}>
          {branding.logoText}
        </span>
      )}
    </div>
  );
}
