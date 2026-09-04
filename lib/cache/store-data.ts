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
    .select('id, name, base_usd, images, active, collections, made_to_order')
    .in('id', productIds)
    .eq('active', true);
  
  return data || [];
});

export const getProductsByIds = unstable_cache(
  async (productIds: string[]) => getProductsByIdsInternal(productIds),
  ['products-by-ids', 'v2-made-to-order'],
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
    .select(
      'id, product_id, name, price_adjustment_usd, active, size, color, image_url, inventory_count'
    )
    .in('product_id', productIds)
    .eq('active', true);
  
  return data || [];
});

export const getVariantsByProductIds = unstable_cache(
  async (productIds: string[]) => getVariantsByProductIdsInternal(productIds),
  ['variants-by-product-ids', 'v2-inventory-count'],
  {
    revalidate: 300, // 5 minutes
    tags: ['product-variants'],
  }
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
  const { data } = await supabase
    .from('product_variants')
    .select('product_id, inventory_count')
    .eq('active', true);

  return data || [];
});

export const getVariantStockSummary = unstable_cache(
  async () => getVariantStockSummaryInternal(),
  ['variant-stock-summary'],
  {
    revalidate: 300, // 5 minutes
    tags: ['product-variants'],
  }
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
  
  return {
    product: productResult.data,
    variants: variantsResult.data || [],
  };
});

export const getProductWithVariants = unstable_cache(
  async (productId: string) => getProductWithVariantsInternal(productId),
  ['product-with-variants', 'v2-made-to-order'],
  {
    revalidate: 300, // 5 minutes
    tags: ['products', 'product-variants'],
  }
);
