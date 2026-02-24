import { cache } from 'react';

// AGGRESSIVE CACHING STRATEGY
// This file provides cached versions of frequently-accessed, rarely-changing data
// Trade-off: Data might be up to X minutes stale, but much faster performance

// Note: We're using React cache() for request-level deduplication
// Next.js will handle page-level caching via revalidation settings

// For store-data.ts functions, we'll use them directly since they already
// provide request-level caching. The page-level caching comes from:
// 1. Static generation settings (revalidate)
// 2. Manual revalidation after mutations

// Re-export the existing cached functions from store-data
export { 
  getStoreSettings,
  getFilterMetadata,
  getProductsByIds,
  getVariantsByProductIds,
  getProductWithVariants 
} from '@/lib/cache/store-data';

// Helper to revalidate paths after data changes
export async function revalidateProductPages() {
  const { revalidatePath } = await import('next/cache');
  revalidatePath('/dashboard');
  revalidatePath('/catalog');
  revalidatePath('/admin/products');
}

export async function revalidateStoreSettings() {
  const { revalidatePath } = await import('next/cache');
  revalidatePath('/dashboard');
  revalidatePath('/admin/products');
}
