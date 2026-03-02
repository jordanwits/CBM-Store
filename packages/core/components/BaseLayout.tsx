import React from 'react';
import { BrandingProvider, BrandingConfig } from "./BrandingProvider";
import DevModeBanner from "./DevModeBanner";

export default function BaseLayout({
  children,
  branding,
}: {
  children: React.ReactNode;
  branding: BrandingConfig;
}) {
  return (
    <BrandingProvider branding={branding}>
      <DevModeBanner />
      {children}
    </BrandingProvider>
  );
}
