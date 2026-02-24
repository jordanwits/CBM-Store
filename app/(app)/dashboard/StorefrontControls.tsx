'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Select } from 'core/components/Select';

interface StorefrontControlsProps {
  currentSort?: string;
}

const SORT_OPTIONS = [
  { value: 'featured', label: 'Featured' },
  { value: 'newest', label: 'Newest' },
  { value: 'priceAsc', label: 'Price: Low to High' },
  { value: 'priceDesc', label: 'Price: High to Low' },
  { value: 'nameAsc', label: 'Name: A-Z' },
];

export function StorefrontControls({ currentSort = 'featured' }: StorefrontControlsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSortChange = (newSort: string) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (newSort === 'featured') {
      params.delete('sort');
    } else {
      params.set('sort', newSort);
    }
    
    const queryString = params.toString();
    router.push(queryString ? `/dashboard?${queryString}` : '/dashboard');
  };

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const query = formData.get('q') as string;
    
    const params = new URLSearchParams(searchParams.toString());
    
    if (query && query.trim()) {
      params.set('q', query.trim());
    } else {
      params.delete('q');
    }
    
    const queryString = params.toString();
    router.push(queryString ? `/dashboard?${queryString}` : '/dashboard');
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
      <form onSubmit={handleSearch} className="flex-1 w-full sm:max-w-md min-w-0">
        <div className="relative">
          <input
            type="text"
            name="q"
            defaultValue={searchParams.get('q') || ''}
            placeholder="Search"
            className="w-full pl-12 pr-4 py-3 bg-gray-100 border-0 rounded-full hover:bg-gray-200 focus:bg-white focus:ring-2 focus:ring-gray-300 text-gray-900 placeholder:text-gray-500 transition-colors"
          />
          <svg 
            className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-500" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </form>
      <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
        <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Sort By</span>
        <Select
          options={SORT_OPTIONS}
          value={currentSort}
          onChange={handleSortChange}
          className="sm:min-w-[160px]"
          wrapperClassName="w-full sm:w-auto sm:min-w-[160px] shrink-0"
        />
      </div>
    </div>
  );
}

