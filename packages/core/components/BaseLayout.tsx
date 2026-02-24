import React from 'react';
import { Geist, Geist_Mono } from "next/font/google";
import { BrandingProvider, BrandingConfig } from "./BrandingProvider";
import DevModeBanner from "./DevModeBanner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap", // Prevent FOIT (Flash of Invisible Text)
  preload: true, // Preload fonts for faster rendering
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false, // Only preload the primary font
});

export default function BaseLayout({
  children,
  branding,
}: {
  children: React.ReactNode;
  branding: BrandingConfig;
}) {
  return (
    <html 
      lang="en"
      style={{
        '--primary': branding.colors.primary,
        '--primary-foreground': branding.colors.primaryForeground,
        '--secondary': branding.colors.secondary,
        '--secondary-foreground': branding.colors.secondaryForeground,
      } as React.CSSProperties}
    >
      <head>
        {/* Preconnect to Google Fonts for faster font loading */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* DNS prefetch for Supabase */}
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
      </head>
      <body 
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <BrandingProvider branding={branding}>
          <DevModeBanner />
          {children}
        </BrandingProvider>
      </body>
    </html>
  );
}
