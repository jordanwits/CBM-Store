import { Card, CardContent } from 'core/components/Card';
import { Badge } from 'core/components/Badge';
import { BackButton } from 'core/components/BackButton';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import AddToCartButton from './AddToCartButton';
import ImageGallery from './ImageGallery';
import ProductPageClient from './ProductPageClient';
import { getStoreSettings, getProductWithVariants } from '@/lib/cache/store-data';

// Cache product pages for 5 minutes (products don't change often)
export const revalidate = 300;

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  
  // Check if using placeholder Supabase (dev mode)
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  
  let conversionRate = 100;
  let product: any = null;
  let variants: any[] = [];
  
  if (isDevMode) {
    // Mock data for dev mode
    const mockProducts = [
      {
        id: '1',
        name: 'Company Logo T-Shirt',
        description: 'Premium cotton t-shirt with embroidered company logo. Made from 100% organic cotton for comfort and durability. Available in multiple sizes.',
        base_usd: 25.00,
        images: ['/ChrisCrossBlackCottonT-Shirt.webp'],
        active: true,
      },
      {
        id: '2',
        name: 'Insulated Water Bottle',
        description: 'Keep your drinks cold for 24 hours or hot for 12 hours with this premium stainless steel insulated water bottle. Features the company logo.',
        base_usd: 35.00,
        images: ['/KiyoUVC-Bottle_Studio_Fullsize-500ml_Black_C2_4480x.jpg'],
        active: true,
      },
      {
        id: '3',
        name: 'Laptop Backpack',
        description: 'Durable laptop backpack with padded compartment for devices up to 15". Multiple pockets for organization and comfort straps.',
        base_usd: 75.00,
        images: ['/1200W-18684-Black-0-NKDH7709BlackBagFront3.jpg'],
        active: true,
      },
      {
        id: '4',
        name: 'Wireless Mouse',
        description: 'Ergonomic wireless mouse with company branding. Includes USB receiver and batteries.',
        base_usd: 45.00,
        images: ['/b43457a0-76b6-11f0-9faf-5258f188704a.png'],
        active: true,
      },
      {
        id: '5',
        name: 'Notebook Set',
        description: 'Set of 3 premium notebooks with company logo. Lined pages, elastic closure.',
        base_usd: 20.00,
        images: ['/moleskine-classic-hardcover-notebook-black.webp'],
        active: true,
      },
    ];
    
    product = mockProducts.find((p) => p.id === id);
    
    // Mock variants for the t-shirt (sizes and colors)
    if (id === '1') {
      variants = [
        { id: 'v1', product_id: '1', name: 'Small - Black', size: 'S', color: 'Black', price_adjustment_usd: 0, active: true },
        { id: 'v2', product_id: '1', name: 'Medium - Black', size: 'M', color: 'Black', price_adjustment_usd: 0, active: true },
        { id: 'v3', product_id: '1', name: 'Large - Black', size: 'L', color: 'Black', price_adjustment_usd: 0, active: true },
        { id: 'v4', product_id: '1', name: 'X-Large - Black', size: 'XL', color: 'Black', price_adjustment_usd: 0, active: true },
        { id: 'v5', product_id: '1', name: 'Small - Blue', size: 'S', color: 'Blue', price_adjustment_usd: 0, active: true },
        { id: 'v6', product_id: '1', name: 'Medium - Blue', size: 'M', color: 'Blue', price_adjustment_usd: 0, active: true },
        { id: 'v7', product_id: '1', name: 'Large - Blue', size: 'L', color: 'Blue', price_adjustment_usd: 0, active: true },
        { id: 'v8', product_id: '1', name: 'X-Large - Blue', size: 'XL', color: 'Blue', price_adjustment_usd: 0, active: true },
      ];
    }
    // Mock variants for water bottle (colors only)
    if (id === '2') {
      variants = [
        { id: 'v9', product_id: '2', name: 'Black', color: 'Black', price_adjustment_usd: 0, active: true },
        { id: 'v10', product_id: '2', name: 'Blue', color: 'Blue', price_adjustment_usd: 0, active: true },
        { id: 'v11', product_id: '2', name: 'Silver', color: 'Silver', price_adjustment_usd: 0, active: true },
      ];
    }
  } else {
    // Fetch store settings and product data in parallel for faster loading
    const [settings, productData] = await Promise.all([
      getStoreSettings(),
      getProductWithVariants(id),
    ]);

    conversionRate = settings.conversionRate;
    product = productData.product;
    variants = productData.variants;
  }

  if (!product) {
    notFound();
  }

  const basePoints = Math.round(product.base_usd * conversionRate);

  return (
    <div>
      {/* Back Button and Breadcrumb */}
      <div className="mb-6 space-y-3">
        <BackButton href="/dashboard" label="Back to Shop" />
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/dashboard" className="text-gray-600 hover:text-gray-900 font-medium">
            Shop
          </Link>
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-gray-900 font-medium truncate">{product.name}</span>
        </nav>
      </div>

      <ProductPageClient
        product={product}
        variants={variants}
        basePoints={basePoints}
        conversionRate={conversionRate}
      />
    </div>
  );
}
