import type { Metadata } from "next";
import BaseLayout from "core/components/BaseLayout";
import { AuthTokenRedirect } from "@/components/AuthTokenRedirect";
import { cbmBranding } from "../branding";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

export const metadata: Metadata = {
  title: `${cbmBranding.appName} - Rewards Merch Shop`,
  description: `Redeem your points for branded merchandise at ${cbmBranding.appName}`,
  // Performance optimizations
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://cbmplasticsstore.com'),
  openGraph: {
    type: 'website',
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
    <BaseLayout branding={cbmBranding}>
      <AuthTokenRedirect />
      {children}
      <SpeedInsights />
      {/* Preload critical logo for faster LCP */}
      {cbmBranding.logo && (
        <link
          rel="preload"
          href={cbmBranding.logo.src}
          as="image"
          type="image/png"
        />
      )}
    </BaseLayout>
  );
}
