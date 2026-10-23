import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
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

/**
 * unstable_cache keeps whatever the function hands back for five minutes, a fallback after a
 * failed read included, so one Supabase hiccup used to serve a default conversion rate, 404s
 * or "In stock" to everyone until the entry expired. The cached reads below throw on an
 * error instead, which unstable_cache does not store, and this gives that one request the
 * same fallback it used to get.
 */
function withFallback<Args extends unknown[], T>(
  cached: (...args: Args) => Promise<T>,
  fallback: () => T,
  label: string
): (...args: Args) => Promise<T> {
  return async (...args: Args) => {
    try {
      return await cached(...args);
    } catch (error) {
      console.error(`Error reading ${label}:`, error);
      return fallback();
    }
  };
}

// Cache store settings with dual-layer caching:
// - React cache() for request-level deduplication
// - unstable_cache for persistent caching across requests (5 minutes)
const getStoreSettingsInternal = cache(async () => {
  const supabase = await createReadClient();
  const { data, error } = await supabase
    .from('store_settings')
    .select('usd_to_points_rate')
    .single();

  if (error) throw error;

  return {
    conversionRate: data?.usd_to_points_rate || 100,
  };
});

export const getStoreSettings = withFallback(
  unstable_cache(
    async () => getStoreSettingsInternal(),
    ['store-settings'],
    {
      revalidate: 300, // 5 minutes
      tags: ['store-settings'],
    }
  ),
  () => ({ conversionRate: 100 }),
  'store settings'
);

// Cache filter metadata with dual-layer caching:
// - React cache() for request-level deduplication
// - unstable_cache for persistent caching across requests (5 minutes)
const getFilterMetadataInternal = cache(async () => {
  const supabase = await createReadClient();
  const { data, error } = await supabase.rpc('get_filter_metadata');

  if (error) throw error;

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

export const getFilterMetadata = withFallback(
  unstable_cache(
    async () => getFilterMetadataInternal(),
    ['filter-metadata'],
    {
      revalidate: 300, // 5 minutes
      tags: ['filter-metadata'],
    }
  ),
  () => ({ categories: [], collections: [], sizes: [], colors: [] }),
  'filter metadata'
);

// Fetch products by IDs (for cart) - more efficient than fetching all
// Uses dual-layer caching: React cache() + unstable_cache
const getProductsByIdsInternal = cache(async (productIds: string[]) => {
  if (productIds.length === 0) return [];

  const supabase = await createReadClient();
  const { data, error } = await supabase
    .from('products')
    .select('id, name, base_usd, images, active, collections, made_to_order')
    .in('id', productIds)
    .eq('active', true);

  if (error) throw error;

  return data || [];
});

export const getProductsByIds = withFallback(
  unstable_cache(
    async (productIds: string[]) => getProductsByIdsInternal(productIds),
    ['products-by-ids', 'v2-made-to-order'],
    {
      revalidate: 300, // 5 minutes
      tags: ['products'],
    }
  ),
  () => [],
  'products by id'
);

// Fetch variants by product IDs (for cart) - more efficient than fetching all
// Uses dual-layer caching: React cache() + unstable_cache
const getVariantsByProductIdsInternal = cache(async (productIds: string[]) => {
  if (productIds.length === 0) return [];

  const supabase = await createReadClient();
  const { data, error } = await supabase
    .from('product_variants')
    .select(
      'id, product_id, name, price_adjustment_usd, active, size, color, image_url, inventory_count'
    )
    .in('product_id', productIds)
    .eq('active', true);

  if (error) throw error;

  return data || [];
});

export const getVariantsByProductIds = withFallback(
  unstable_cache(
    async (productIds: string[]) => getVariantsByProductIdsInternal(productIds),
    ['variants-by-product-ids', 'v2-inventory-count'],
    {
      revalidate: 300, // 5 minutes
      tags: ['product-variants'],
    }
  ),
  () => [],
  'variants by product'
);

// Stock levels for the catalog grid, which needs an availability band per card but none of
// the rest of a variant row.
//
// Deliberately one query for the whole catalog under a single cache key rather than one per
// filtered page of products: the grid's product ids change with every filter combination,
// and keying on them would shred the cache into an entry per combination while querying the
// same handful of rows each time. Two columns over active variants is small enough to hold
// whole, and it shares the 'product-variants' tag, so an admin stock edit or a placed order
// drops it along with everything else.
const getVariantStockSummaryInternal = cache(async () => {
  const supabase = await createReadClient();
  // Every active variant, not the first 1000: a product whose rows fell past the cap would
  // read as having no stock rows at all, which shows as "In stock"
  const { data, error } = await fetchAllRows((from, to) =>
    supabase
      .from('product_variants')
      .select('product_id, inventory_count')
      .eq('active', true)
      .order('id')
      .range(from, to)
  );

  if (error) throw error;

  return data;
});

export const getVariantStockSummary = withFallback(
  unstable_cache(
    async () => getVariantStockSummaryInternal(),
    ['variant-stock-summary'],
    {
      revalidate: 300, // 5 minutes
      tags: ['product-variants'],
    }
  ),
  () => [],
  'variant stock summary'
);

/** Group a stock summary by product, ready for productAvailability. */
export function groupStockByProduct(
  rows: Array<{ product_id: string; inventory_count: number | null }>
): Map<string, Array<{ inventory_count: number | null }>> {
  const byProduct = new Map<string, Array<{ inventory_count: number | null }>>();

  for (const row of rows) {
    const existing = byProduct.get(row.product_id);
    if (existing) {
      existing.push({ inventory_count: row.inventory_count });
    } else {
      byProduct.set(row.product_id, [{ inventory_count: row.inventory_count }]);
    }
  }

  return byProduct;
}

// Combined product and variant fetch for a single product (product detail page)
// Uses dual-layer caching: React cache() + unstable_cache
const getProductWithVariantsInternal = cache(async (productId: string) => {
  const supabase = await createReadClient();

  // Run both queries in parallel
  const [productResult, variantsResult] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, description, base_usd, images, active, category, collections, made_to_order')
      .eq('id', productId)
      .eq('active', true)
      .single(),
    supabase
      .from('product_variants')
      .select('id, product_id, name, size, color, price_adjustment_usd, image_url, active, inventory_count, sku')
      .eq('product_id', productId)
      .eq('active', true),
  ]);

  // No matching active product (PGRST116 from .single()) is an answer worth caching; any
  // other error is a failed read. A malformed id is a 22P02, which is also no product.
  const productMissing =
    productResult.error?.code === 'PGRST116' || productResult.error?.code === '22P02';
  if (productResult.error && !productMissing) throw productResult.error;
  if (variantsResult.error && !productMissing) throw variantsResult.error;

  return {
    product: productResult.data,
    variants: variantsResult.data || [],
  };
});

export const getProductWithVariants = withFallback(
  unstable_cache(
    async (productId: string) => getProductWithVariantsInternal(productId),
    ['product-with-variants', 'v2-made-to-order'],
    {
      revalidate: 300, // 5 minutes
      tags: ['products', 'product-variants'],
    }
  ),
  () => ({ product: null, variants: [] }),
  'product with variants'
);
