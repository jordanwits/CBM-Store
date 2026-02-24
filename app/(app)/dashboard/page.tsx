import { createClient } from '@/lib/supabase/server';
import { getJwtSubject } from '@/lib/auth/jwt';
import { Card, CardContent } from 'core/components/Card';
import { Badge } from 'core/components/Badge';
import Link from 'next/link';
import Image from 'next/image';
import { StorefrontControls } from './StorefrontControls';
import { FilterPanel } from './FilterPanel';
import { FilterDrawer } from 'core/components/FilterDrawer';
import { getStoreSettings, getFilterMetadata } from '@/lib/cache/store-data';

// Enable aggressive caching: Revalidate this page every 5 minutes
// This means the page will be statically generated and served from cache
// Users will see data that's at most 5 minutes old
export const revalidate = 300;

interface SearchParams {
  q?: string;
  category?: string;
  collections?: string | string[];
  size?: string | string[];
  color?: string | string[];
  minUsd?: string;
  maxUsd?: string;
  sort?: 'featured' | 'newest' | 'priceAsc' | 'priceDesc' | 'nameAsc';
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  
  // Check if using placeholder Supabase (dev mode)
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  
  let pointsBalance = 0;
  let conversionRate = 100;
  let products: any[] = [];
  let allCategories: string[] = [];
  let allCollections: string[] = [];
  let allSizes: string[] = [];
  let allColors: string[] = [];
  
  if (isDevMode) {
    // Mock data for dev mode
    pointsBalance = 5500;
    
    const mockProducts = [
      {
        id: '1',
        name: 'Company Logo T-Shirt',
        description: 'Premium cotton t-shirt with embroidered company logo',
        base_usd: 25.00,
        images: ['/ChrisCrossBlackCottonT-Shirt.webp'],
        active: true,
        category: 'Apparel',
        collections: ['New Arrivals', 'Essentials'],
      },
      {
        id: '2',
        name: 'Insulated Water Bottle',
        description: 'Stainless steel insulated water bottle',
        base_usd: 35.00,
        images: ['/KiyoUVC-Bottle_Studio_Fullsize-500ml_Black_C2_4480x.jpg'],
        active: true,
        category: 'Drinkware',
        collections: ['Essentials', 'Eco-Friendly'],
      },
      {
        id: '3',
        name: 'Laptop Backpack',
        description: 'Durable laptop backpack with padded compartment',
        base_usd: 75.00,
        images: ['/1200W-18684-Black-0-NKDH7709BlackBagFront3.jpg'],
        active: true,
        category: 'Bags',
        collections: ['Premium', 'Work Essentials'],
      },
      {
        id: '4',
        name: 'Wireless Mouse',
        description: 'Ergonomic wireless mouse with company branding',
        base_usd: 45.00,
        images: ['/b43457a0-76b6-11f0-9faf-5258f188704a.png'],
        active: true,
        category: 'Electronics',
        collections: ['Premium', 'Electronics'],
      },
      {
        id: '5',
        name: 'Notebook Set',
        description: 'Set of 3 premium notebooks with company logo',
        base_usd: 20.00,
        images: ['/moleskine-classic-hardcover-notebook-black.webp'],
        active: true,
        category: 'Office',
        collections: ['Essentials'],
      },
    ];

    const mockVariants = [
      { product_id: '1', size: 'S', color: 'Blue' },
      { product_id: '1', size: 'M', color: 'Blue' },
      { product_id: '1', size: 'L', color: 'Blue' },
      { product_id: '1', size: 'XL', color: 'Blue' },
      { product_id: '1', size: 'S', color: 'Black' },
      { product_id: '1', size: 'M', color: 'Black' },
      { product_id: '1', size: 'L', color: 'Black' },
      { product_id: '1', size: 'XL', color: 'Black' },
      { product_id: '2', color: 'Blue' },
      { product_id: '2', color: 'Black' },
      { product_id: '2', color: 'Silver' },
    ];
    
    // Apply filters to mock data
    products = mockProducts.filter(p => {
      // Search filter
      if (params.q) {
        const query = params.q.toLowerCase();
        if (!p.name.toLowerCase().includes(query) && !p.description.toLowerCase().includes(query)) {
          return false;
        }
      }
      
      // Category filter
      if (params.category && p.category !== params.category) {
        return false;
      }
      
      // Collections filter
      if (params.collections) {
        const selectedCollections = Array.isArray(params.collections) ? params.collections : [params.collections];
        const hasMatch = selectedCollections.some(c => p.collections?.includes(c));
        if (!hasMatch) return false;
      }
      
      // Price range filter
      if (params.minUsd && p.base_usd < parseFloat(params.minUsd)) {
        return false;
      }
      if (params.maxUsd && p.base_usd > parseFloat(params.maxUsd)) {
        return false;
      }
      
      // Size/Color filters - check if product has matching variants
      if (params.size || params.color) {
        const productVariants = mockVariants.filter(v => v.product_id === p.id);
        
        if (params.size) {
          const selectedSizes = Array.isArray(params.size) ? params.size : [params.size];
          const hasSize = productVariants.some(v => v.size && selectedSizes.includes(v.size));
          if (!hasSize) return false;
        }
        
        if (params.color) {
          const selectedColors = Array.isArray(params.color) ? params.color : [params.color];
          const hasColor = productVariants.some(v => v.color && selectedColors.includes(v.color));
          if (!hasColor) return false;
        }
      }
      
      return true;
    });
    
    // Apply sorting
    if (params.sort === 'priceAsc') {
      products.sort((a, b) => a.base_usd - b.base_usd);
    } else if (params.sort === 'priceDesc') {
      products.sort((a, b) => b.base_usd - a.base_usd);
    } else if (params.sort === 'nameAsc') {
      products.sort((a, b) => a.name.localeCompare(b.name));
    } else if (params.sort === 'newest') {
      // Mock newest by reversing
      products.reverse();
    }
    
    // Extract filter options
    allCategories = [...new Set(mockProducts.map(p => p.category).filter((c): c is string => Boolean(c)))];
    allCollections = [...new Set(mockProducts.flatMap(p => p.collections || []))];
    allSizes = [...new Set(mockVariants.map(v => v.size).filter((s): s is string => Boolean(s)))];
    allColors = [...new Set(mockVariants.map(v => v.color).filter((c): c is string => Boolean(c)))];
    
  } else {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.access_token ? getJwtSubject(session.access_token) : null;

    if (!userId) return null;

    // Run initial queries in parallel for faster loading
    // Using cached functions for settings and filters (data that rarely changes)
    const [pointsResult, settings, filters] = await Promise.all([
      supabase.rpc('get_user_points_balance', { p_user_id: userId }),
      getStoreSettings(),
      getFilterMetadata(),
    ]);

    pointsBalance = pointsResult.data || 0;
    conversionRate = settings.conversionRate;
    
    // Use cached filter metadata
    allCategories = filters.categories;
    allCollections = filters.collections;
    allSizes = filters.sizes;
    allColors = filters.colors;

    // Build product query with filters
    let query = supabase
      .from('products')
      .select('id, name, description, base_usd, images, active, category, collections, created_at')
      .eq('active', true);

    // Apply category filter
    if (params.category) {
      query = query.eq('category', params.category);
    }

    // Apply price range filters
    if (params.minUsd) {
      query = query.gte('base_usd', parseFloat(params.minUsd));
    }
    if (params.maxUsd) {
      query = query.lte('base_usd', parseFloat(params.maxUsd));
    }

    // Apply text search
    if (params.q) {
      query = query.or(`name.ilike.%${params.q}%,description.ilike.%${params.q}%`);
    }

    // Apply sorting
    if (params.sort === 'priceAsc') {
      query = query.order('base_usd', { ascending: true });
    } else if (params.sort === 'priceDesc') {
      query = query.order('base_usd', { ascending: false });
    } else if (params.sort === 'nameAsc') {
      query = query.order('name', { ascending: true });
    } else if (params.sort === 'newest') {
      query = query.order('created_at', { ascending: false });
    } else {
      query = query.order('name');
    }

    const { data: prods } = await query;
    let filteredProducts = prods || [];

    // Apply collections filter (AND logic - product must have ALL selected collections)
    if (params.collections && filteredProducts.length > 0) {
      const selectedCollections = Array.isArray(params.collections) ? params.collections : [params.collections];
      filteredProducts = filteredProducts.filter(p => 
        p.collections && selectedCollections.every((c: string) => p.collections.includes(c))
      );
    }

    // Apply size/color filters via variants - filters stack (AND logic across types)
    if ((params.size || params.color) && filteredProducts.length > 0) {
      // Run size and color queries in parallel for better performance
      const [sizeResult, colorResult] = await Promise.all([
        params.size
          ? supabase
              .from('product_variants')
              .select('product_id')
              .eq('active', true)
              .in('size', Array.isArray(params.size) ? params.size : [params.size])
          : Promise.resolve({ data: null }),
        params.color
          ? supabase
              .from('product_variants')
              .select('product_id')
              .eq('active', true)
              .in('color', Array.isArray(params.color) ? params.color : [params.color])
          : Promise.resolve({ data: null }),
      ]);

      let productIds = new Set(filteredProducts.map(p => p.id));

      // Apply size filter (keep products that have ANY of the selected sizes)
      if (sizeResult.data) {
        const sizeProductIds = new Set(sizeResult.data.map(v => v.product_id));
        productIds = new Set([...productIds].filter(id => sizeProductIds.has(id)));
      }

      // Apply color filter (keep products that have ANY of the selected colors)
      // This stacks with size filter using AND logic
      if (colorResult.data) {
        const colorProductIds = new Set(colorResult.data.map(v => v.product_id));
        productIds = new Set([...productIds].filter(id => colorProductIds.has(id)));
      }

      // Filter products to only those matching all variant criteria
      filteredProducts = filteredProducts.filter(p => productIds.has(p.id));
    }

    products = filteredProducts;
    
    // Filter metadata already loaded in parallel at the start
  }

  // Helper to build filter URL
  const buildFilterUrl = (updates: Partial<SearchParams>) => {
    const newParams = new URLSearchParams();
    
    // Preserve existing params
    if (params.q && !('q' in updates)) newParams.set('q', params.q);
    if (params.category && !('category' in updates)) newParams.set('category', params.category);
    if (params.minUsd && !('minUsd' in updates)) newParams.set('minUsd', params.minUsd);
    if (params.maxUsd && !('maxUsd' in updates)) newParams.set('maxUsd', params.maxUsd);
    if (params.sort && !('sort' in updates)) newParams.set('sort', params.sort);
    
    // Handle array params
    if (params.collections && !('collections' in updates)) {
      const cols = Array.isArray(params.collections) ? params.collections : [params.collections];
      cols.forEach(c => newParams.append('collections', c));
    }
    if (params.size && !('size' in updates)) {
      const sizes = Array.isArray(params.size) ? params.size : [params.size];
      sizes.forEach(s => newParams.append('size', s));
    }
    if (params.color && !('color' in updates)) {
      const colors = Array.isArray(params.color) ? params.color : [params.color];
      colors.forEach(c => newParams.append('color', c));
    }
    
    // Apply updates
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        if (Array.isArray(value)) {
          value.forEach(v => newParams.append(key, v));
        } else {
          newParams.set(key, value);
        }
      }
    });
    
    const queryString = newParams.toString();
    return queryString ? `/dashboard?${queryString}` : '/dashboard';
  };

  const hasActiveFilters = !!(params.q || params.category || params.collections || params.size || params.color || params.minUsd || params.maxUsd);

  const pointsBalanceCard = (
    <div className="bg-gradient-to-br from-primary/10 to-secondary/10 rounded-lg py-4 mb-3">
      <p className="text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Your Points</p>
      <p className="text-3xl font-bold text-primary">{pointsBalance.toLocaleString()}</p>
      <Link href="/points-history" className="text-xs text-secondary hover:text-secondary/80 font-bold inline-flex items-center gap-1 mt-2 transition-colors">
        View History
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );

  const filterContent = (
    <div className="sticky top-16 pt-4 space-y-3 lg:pt-4">
      {/* Points Balance - desktop sidebar only */}
      <div className="hidden lg:block">{pointsBalanceCard}</div>
      {/* Filter Controls */}
      <FilterPanel 
        allCategories={allCategories}
        allCollections={allCollections}
        allSizes={allSizes}
        allColors={allColors}
        hasActiveFilters={hasActiveFilters}
      />
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Points Balance - mobile only */}
      <div className="lg:hidden">{pointsBalanceCard}</div>
      {/* Desktop: sidebar | Main. Mobile: Main only */}
      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-w-0">
        {/* Desktop sidebar - Filters */}
        <div className="hidden lg:block flex-shrink-0">
          <FilterDrawer
            triggerLabel="Filters"
            hasActiveFilters={hasActiveFilters}
            wrapperClassName="lg:w-52"
          >
            {filterContent}
          </FilterDrawer>
        </div>
        {/* Main content - search row + product grid full width */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
        {/* Search row - Filters button to right of search on mobile */}
        <div className="flex flex-row gap-3 items-start shrink-0">
          <div className="flex-1 min-w-0 order-1 lg:order-2">
            <StorefrontControls currentSort={params.sort || 'featured'} />
          </div>
          <div className="order-2 lg:order-1 flex-shrink-0 lg:hidden">
            <FilterDrawer
              triggerLabel="Filters"
              hasActiveFilters={hasActiveFilters}
            >
              {filterContent}
            </FilterDrawer>
          </div>
        </div>
        {/* Results count and active filters - full width */}
        <div className="flex items-center justify-between flex-wrap gap-4">
            <h2 className="text-xl font-bold text-gray-900">
              {params.category || 'All Products'} ({products.length})
            </h2>
            {hasActiveFilters && (
              <div className="flex flex-wrap gap-2">
                {params.category && (
                  <Link 
                    href={buildFilterUrl({ category: undefined })}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-sm font-medium text-gray-700 transition-colors"
                  >
                    {params.category}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </Link>
                )}
                {params.q && (
                  <Link 
                    href={buildFilterUrl({ q: undefined })}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-sm font-medium text-gray-700 transition-colors"
                  >
                    &quot;{params.q}&quot;
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </Link>
                )}
              </div>
            )}
        </div>

        {/* Product Grid */}
        {products && products.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-x-3 gap-y-10">
            {products.map((product) => {
              const pointsPrice = Math.round(product.base_usd * conversionRate);
              const isNew = product.collections?.includes('New Arrivals');
              
              return (
                <Link key={product.id} href={`/product/${product.id}`} className="group">
                  <div className="relative border-2 border-transparent hover:border-secondary/40 rounded-lg p-2 transition-all duration-200">
                    {/* Product Image */}
                    <div className="aspect-square relative bg-gray-50 overflow-hidden mb-3">
                      {product.images && product.images.length > 0 ? (
                        <Image
                          src={product.images[0]}
                          alt={product.name}
                          fill
                          className="object-cover object-[center_30%] transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="w-20 h-20 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    
                    {/* Product Info */}
                    <div className="space-y-2">
                      {/* Just In Badge */}
                      {isNew && (
                        <span className="inline-block px-2 py-1 text-xs font-bold text-secondary-foreground bg-secondary rounded uppercase tracking-wide">Just In</span>
                      )}
                      
                      {/* Product Name */}
                      <h3 className="text-base font-semibold text-gray-900 line-clamp-2 group-hover:underline">
                        {product.name}
                      </h3>
                      
                      {/* Category */}
                      {product.category && (
                        <p className="text-sm text-gray-500">{product.category}</p>
                      )}
                      
                      {/* Price */}
                      <p className="text-base font-bold text-secondary pt-1">
                        {pointsPrice.toLocaleString()} points
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="py-24 text-center">
            <svg className="w-20 h-20 text-gray-300 mx-auto mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No products found</h3>
            <p className="text-base text-gray-600 mb-6">Try adjusting your filters or search terms</p>
            {hasActiveFilters && (
              <Link href="/dashboard" className="inline-block px-6 py-3 bg-gray-900 text-white rounded-full hover:bg-gray-800 transition-colors font-medium">
                Clear all filters
              </Link>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

