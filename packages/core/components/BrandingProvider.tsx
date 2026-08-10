'use client';

import React, { createContext, useContext } from 'react';

export interface BrandingConfig {
  appName: string;
  logoText: string;
  logo?: {
    src: string;
    alt: string;
    width?: number;
    height?: number;
  };
  colors: {
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
  };
  /** Where customers reach a human about an order. Omitted fields hide their button. */
  support?: {
    email?: string;
    /** Display form, e.g. "217-543-3870" */
    phone?: string;
    /** Dial form for tel: links, e.g. "+12175433870". Falls back to phone. */
    phoneDial?: string;
  };
  domain?: string;
}

const BrandingContext = createContext<BrandingConfig | null>(null);

export function BrandingProvider({
  children,
  branding,
}: {
  children: React.ReactNode;
  branding: BrandingConfig;
}) {
  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const context = useContext(BrandingContext);
  if (!context) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }
  return context;
}
