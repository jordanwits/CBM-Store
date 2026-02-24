'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition, useState, useEffect } from 'react';
import Link from 'next/link';

interface FilterPanelProps {
  allCategories: string[];
  allCollections: string[];
  allSizes: string[];
  allColors: string[];
  hasActiveFilters: boolean;
}

export function FilterPanel({ 
  allCategories, 
  allCollections, 
  allSizes, 
  allColors,
  hasActiveFilters 
}: FilterPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const params = {
    q: searchParams.get('q'),
    category: searchParams.get('category'),
    collections: searchParams.getAll('collections'),
    size: searchParams.getAll('size'),
    color: searchParams.getAll('color'),
    minUsd: searchParams.get('minUsd'),
    maxUsd: searchParams.get('maxUsd'),
    sort: searchParams.get('sort'),
  };

  // Optimistic UI state - tracks what the user has clicked before server responds
  const [optimisticState, setOptimisticState] = useState({
    category: params.category,
    collections: params.collections,
    size: params.size,
    color: params.color,
  });

  // Sync optimistic state with actual URL params once navigation completes
  useEffect(() => {
    setOptimisticState({
      category: params.category,
      collections: params.collections,
      size: params.size,
      color: params.color,
    });
  }, [params.category, params.collections.join(','), params.size.join(','), params.color.join(',')]);

  const buildFilterUrl = (updates: any) => {
    const newParams = new URLSearchParams();
    
    // Preserve existing params
    if (params.q && !('q' in updates)) newParams.set('q', params.q);
    if (params.category && !('category' in updates)) newParams.set('category', params.category);
    if (params.minUsd && !('minUsd' in updates)) newParams.set('minUsd', params.minUsd);
    if (params.maxUsd && !('maxUsd' in updates)) newParams.set('maxUsd', params.maxUsd);
    if (params.sort && !('sort' in updates)) newParams.set('sort', params.sort);
    
    // Handle array params
    if (params.collections.length > 0 && !('collections' in updates)) {
      params.collections.forEach(c => newParams.append('collections', c));
    }
    if (params.size.length > 0 && !('size' in updates)) {
      params.size.forEach(s => newParams.append('size', s));
    }
    if (params.color.length > 0 && !('color' in updates)) {
      params.color.forEach(c => newParams.append('color', c));
    }
    
    // Apply updates
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        if (Array.isArray(value)) {
          value.forEach(v => newParams.append(key, v));
        } else {
          newParams.set(key, value as string);
        }
      }
    });
    
    const queryString = newParams.toString();
    return queryString ? `/dashboard?${queryString}` : '/dashboard';
  };

  const handleFilterChange = (updates: any, optimisticUpdate: any) => {
    // Update UI immediately for instant feedback
    setOptimisticState(prev => ({
      ...prev,
      ...optimisticUpdate,
    }));
    
    // Then trigger the actual navigation
    const url = buildFilterUrl(updates);
    startTransition(() => {
      router.push(url);
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-gray-900">Filters</h2>
        {hasActiveFilters && (
          <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900 underline transition-colors">
            Clear
          </Link>
        )}
      </div>

      {/* Show loading indicator - fixed height to prevent layout shift */}
      <div className="h-5 mb-1">
        {isPending && (
          <div className="text-xs text-gray-500 animate-pulse">
            Updating...
          </div>
        )}
      </div>

      <div className="space-y-3">
        {/* Category Filter */}
        {allCategories.length > 0 && (
          <div className="border-b pb-3">
            <h3 className="text-sm font-bold text-gray-900 mb-2">Category</h3>
            <div className="space-y-2">
              {allCategories.map(cat => {
                const isSelected = optimisticState.category === cat;
                const newCategory = isSelected ? undefined : cat;
                return (
                  <button
                    key={cat}
                    onClick={() => handleFilterChange(
                      { category: newCategory },
                      { category: newCategory }
                    )}
                    className={`block w-full text-left text-sm py-2 transition-colors ${
                      isSelected ? 'font-semibold text-gray-900' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Collections Filter */}
        {allCollections.length > 0 && (
          <div className="border-b pb-3">
            <h3 className="text-sm font-bold text-gray-900 mb-2">Collections</h3>
            <div className="space-y-2">
              {allCollections.map(col => {
                const isSelected = optimisticState.collections.includes(col);
                
                let newCollections: string[] | undefined;
                if (isSelected) {
                  newCollections = optimisticState.collections.filter(c => c !== col);
                  if (newCollections.length === 0) newCollections = undefined;
                } else {
                  newCollections = [...optimisticState.collections, col];
                }
                
                return (
                  <button
                    key={col}
                    onClick={() => handleFilterChange(
                      { collections: newCollections },
                      { collections: newCollections || [] }
                    )}
                    className="flex items-center gap-3 text-sm py-2 transition-colors group w-full"
                  >
                    <div className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-colors ${
                      isSelected ? 'bg-primary border-primary' : 'border-gray-300 group-hover:border-gray-500'
                    }`}>
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className={`transition-colors ${isSelected ? 'font-semibold text-gray-900' : 'text-gray-600 group-hover:text-gray-900'}`}>{col}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Size Filter */}
        {allSizes.length > 0 && (
          <div className="border-b pb-3">
            <h3 className="text-sm font-bold text-gray-900 mb-2">Size</h3>
            <div className="flex flex-wrap gap-2">
              {allSizes.map(size => {
                const isSelected = optimisticState.size.includes(size);
                
                let newSizes: string[] | undefined;
                if (isSelected) {
                  newSizes = optimisticState.size.filter(s => s !== size);
                  if (newSizes.length === 0) newSizes = undefined;
                } else {
                  newSizes = [...optimisticState.size, size];
                }
                
                return (
                  <button
                    key={size}
                    onClick={() => handleFilterChange(
                      { size: newSizes },
                      { size: newSizes || [] }
                    )}
                    className={`px-4 py-2 border-2 rounded text-sm font-medium transition-colors ${
                      isSelected 
                        ? 'bg-primary text-white border-primary' 
                        : 'bg-white text-gray-700 border-gray-300 hover:border-primary'
                    }`}
                  >
                    {size}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Color Filter */}
        {allColors.length > 0 && (
          <div className="border-b pb-3">
            <h3 className="text-sm font-bold text-gray-900 mb-2">Color</h3>
            <div className="space-y-2">
              {allColors.map(color => {
                const isSelected = optimisticState.color.includes(color);
                
                let newColors: string[] | undefined;
                if (isSelected) {
                  newColors = optimisticState.color.filter(c => c !== color);
                  if (newColors.length === 0) newColors = undefined;
                } else {
                  newColors = [...optimisticState.color, color];
                }
                
                return (
                  <button
                    key={color}
                    onClick={() => handleFilterChange(
                      { color: newColors },
                      { color: newColors || [] }
                    )}
                    className="flex items-center gap-3 text-sm py-2 transition-colors group w-full"
                  >
                    <div className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-colors ${
                      isSelected ? 'bg-primary border-primary' : 'border-gray-300 group-hover:border-gray-500'
                    }`}>
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className={`transition-colors ${isSelected ? 'font-semibold text-gray-900' : 'text-gray-600 group-hover:text-gray-900'}`}>{color}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
