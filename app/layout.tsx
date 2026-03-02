import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import BaseLayout from "core/components/BaseLayout";
import { AuthTokenRedirect } from "@/components/AuthTokenRedirect";
import { cbmBranding } from "../branding";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: `${cbmBranding.appName} - Rewards Merch Shop`,
  description: `Redeem your points for branded merchandise at ${cbmBranding.appName}`,
  // Performance optimizations
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://cbmplasticsstore.com'),
  icons: {
    icon: '/cbmFavicon.png?v=3',
  },
  openGraph: {
    type: 'website',
    images: [cbmBranding.logo?.src ?? '/cbmFavicon.png'],
  },
  // Optimize robots and indexing
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      style={
        {
          "--primary": cbmBranding.colors.primary,
          "--primary-foreground": cbmBranding.colors.primaryForeground,
          "--secondary": cbmBranding.colors.secondary,
          "--secondary-foreground": cbmBranding.colors.secondaryForeground,
        } as React.CSSProperties
      }
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <BaseLayout branding={cbmBranding}>
          <AuthTokenRedirect />
          {children}
          <SpeedInsights />
        </BaseLayout>
      </body>
    </html>
  );
}
