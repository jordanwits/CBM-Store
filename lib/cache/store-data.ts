import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';

type SupabaseReadClient =
  | ReturnType<typeof createAdminClient>
  | Awaited<ReturnType<typeof createClient>>;

async function createReadClient(): Promise<SupabaseReadClient> {
  // Prefer service-role reads for shared storefront data:
  // - avoids per-request auth lookups
  // - bypasses RLS overhead for public catalog data
  // - enables better caching at the Next.js layer
  try {
    return createAdminClient();
  } catch {
    return await createClient();
  }
}

// Cache store settings with dual-layer caching:
// - React cache() for request-level deduplication
// - unstable_cache for persistent caching across requests (5 minutes)
const getStoreSettingsInternal = cache(async () => {
  const supabase = await createReadClient();
  const { data } = await supabase
    .from('store_settings')
    .select('usd_to_points_rate')
    .single();
  
  return {
    conversionRate: data?.usd_to_points_rate || 100,
  };
});

export const getStoreSettings = unstable_cache(
  async () => getStoreSettingsInternal(),
  ['store-settings'],
  {
    revalidate: 300, // 5 minutes
    tags: ['store-settings'],
  }
);

// Cache filter metadata with dual-layer caching:
// - React cache() for request-level deduplication
// - unstable_cache for persistent caching across requests (5 minutes)
const getFilterMetadataInternal = cache(async () => {
  const supabase = await createReadClient();
  const { data } = await supabase.rpc('get_filter_metadata');
  
  const filterData = data as {
    categories: string[];
    collections: string[];
    sizes: string[];
    colors: string[];
  } | null;
  
  return {
    categories: filterData?.categories || [],
    collections: filterData?.collections || [],
    sizes: filterData?.sizes || [],
    colors: filterData?.colors || [],
  };
});

export const getFilterMetadata = unstable_cache(
  async () => getFilterMetadataInternal(),
  ['filter-metadata'],
  {
    revalidate: 300, // 5 minutes
    tags: ['filter-metadata'],
  }
);

// Fetch products by IDs (for cart) - more efficient than fetching all
// Uses dual-layer caching: React cache() + unstable_cache
const getProductsByIdsInternal = cache(async (productIds: string[]) => {
  if (productIds.length === 0) return [];
  
  const supabase = await createReadClient();
  const { data } = await supabase
    .from('products')
    .select('id, name, base_usd, images, active')
    .in('id', productIds)
    .eq('active', true);
  
  return data || [];
});

export const getProductsByIds = unstable_cache(
  async (productIds: string[]) => getProductsByIdsInternal(productIds),
  ['products-by-ids'],
  {
    revalidate: 300, // 5 minutes
    tags: ['products'],
  }
);

// Fetch variants by product IDs (for cart) - more efficient than fetching all
// Uses dual-layer caching: React cache() + unstable_cache
const getVariantsByProductIdsInternal = cache(async (productIds: string[]) => {
  if (productIds.length === 0) return [];
  
  const supabase = await createReadClient();
  const { data } = await supabase
    .from('product_variants')
    .select('id, product_id, name, price_adjustment_usd, active, size, color, image_url')
    .in('product_id', productIds)
    .eq('active', true);
  
  return data || [];
});

export const getVariantsByProductIds = unstable_cache(
  async (productIds: string[]) => getVariantsByProductIdsInternal(productIds),
  ['variants-by-product-ids'],
  {
    revalidate: 300, // 5 minutes
    tags: ['product-variants'],
  }
);

// Combined product and variant fetch for a single product (product detail page)
// Uses dual-layer caching: React cache() + unstable_cache
const getProductWithVariantsInternal = cache(async (productId: string) => {
  const supabase = await createReadClient();
  
  // Run both queries in parallel
  const [productResult, variantsResult] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, description, base_usd, images, active, category, collections')
      .eq('id', productId)
      .eq('active', true)
      .single(),
    supabase
      .from('product_variants')
      .select('id, product_id, name, size, color, price_adjustment_usd, image_url, active, inventory_count, sku')
      .eq('product_id', productId)
      .eq('active', true),
  ]);
  
  return {
    product: productResult.data,
    variants: variantsResult.data || [],
  };
});

export const getProductWithVariants = unstable_cache(
  async (productId: string) => getProductWithVariantsInternal(productId),
  ['product-with-variants'],
  {
    revalidate: 300, // 5 minutes
    tags: ['products', 'product-variants'],
  }
);
