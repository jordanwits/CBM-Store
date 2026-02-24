'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useTransition } from 'react';
import { Input } from 'core/components/Input';

interface AdminHistoryFiltersProps {
  currentDays?: number;
}

export function AdminHistoryFilters({ currentDays }: AdminHistoryFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  
  // Disable automatic scroll restoration to prevent browser from scrolling to top
  useEffect(() => {
    if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
      const originalScrollRestoration = window.history.scrollRestoration;
      window.history.scrollRestoration = 'manual';
      
      return () => {
        window.history.scrollRestoration = originalScrollRestoration;
      };
    }
  }, []);
  
  // Get current filter values from URL
  const daysParam = searchParams.get('days');
  const startDateParam = searchParams.get('startDate');
  const endDateParam = searchParams.get('endDate');
  const typeParam = searchParams.get('type') || 'all';
  const minPointsParam = searchParams.get('minPoints');
  const maxPointsParam = searchParams.get('maxPoints');
  const reasonParam = searchParams.get('reason');
  const userEmailParam = searchParams.get('userEmail');

  const [startDate, setStartDate] = useState(startDateParam || '');
  const [endDate, setEndDate] = useState(endDateParam || '');
  const [type, setType] = useState<'all' | 'earned' | 'spent'>(typeParam as 'all' | 'earned' | 'spent' || 'all');
  const [minPoints, setMinPoints] = useState(minPointsParam || '');
  const [maxPoints, setMaxPoints] = useState(maxPointsParam || '');
  const [reason, setReason] = useState(reasonParam || '');
  const [userEmail, setUserEmail] = useState(userEmailParam || '');

  // Update local state when URL params change
  useEffect(() => {
    setStartDate(startDateParam || '');
    setEndDate(endDateParam || '');
    setType((typeParam as 'all' | 'earned' | 'spent') || 'all');
    setMinPoints(minPointsParam || '');
    setMaxPoints(maxPointsParam || '');
    setReason(reasonParam || '');
    setUserEmail(userEmailParam || '');
  }, [startDateParam, endDateParam, typeParam, minPointsParam, maxPointsParam, reasonParam, userEmailParam]);

  const buildFilterUrl = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams();
    
    // Preserve existing params
    if (daysParam && !('days' in updates)) params.set('days', daysParam);
    if (startDateParam && !('startDate' in updates)) params.set('startDate', startDateParam);
    if (endDateParam && !('endDate' in updates)) params.set('endDate', endDateParam);
    if (typeParam && !('type' in updates)) params.set('type', typeParam);
    if (minPointsParam && !('minPoints' in updates)) params.set('minPoints', minPointsParam);
    if (maxPointsParam && !('maxPoints' in updates)) params.set('maxPoints', maxPointsParam);
    if (reasonParam && !('reason' in updates)) params.set('reason', reasonParam);
    if (userEmailParam && !('userEmail' in updates)) params.set('userEmail', userEmailParam);
    
    // Apply updates
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });
    
    // Reset to page 1 when filters change
    params.set('page', '1');
    
    return `/admin/points?${params.toString()}`;
  };

  // Helper to navigate while preserving scroll position
  const navigateWithScrollPreservation = (url: string, e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    const scrollY = window.scrollY;
    
    // Only preserve scroll if we're not at the top
    if (scrollY > 100) {
      sessionStorage.setItem('adminPointsScroll', scrollY.toString());
      
      // Continuously prevent scroll to top during navigation
      let scrollPreventionCount = 0;
      const maxPreventionAttempts = 50; // Prevent for up to 500ms
      
      const preventScrollInterval = setInterval(() => {
        scrollPreventionCount++;
        if (window.scrollY < scrollY - 50) {
          window.scrollTo({ top: scrollY, behavior: 'instant' });
        }
        if (scrollPreventionCount >= maxPreventionAttempts) {
          clearInterval(preventScrollInterval);
        }
      }, 10);
      
      startTransition(() => {
        router.replace(url);
        
        // Clean up interval after navigation
        setTimeout(() => {
          clearInterval(preventScrollInterval);
        }, 500);
      });
    } else {
      // If near top, just navigate normally
      startTransition(() => {
        router.replace(url);
      });
    }
  };

  // Restore scroll position when URL params change
  useEffect(() => {
    const savedScroll = sessionStorage.getItem('adminPointsScroll');
    
    if (savedScroll) {
      const scrollValue = parseInt(savedScroll, 10);
      
      // Aggressive scroll restoration - try multiple times
      const restoreScroll = () => {
        if (window.scrollY !== scrollValue) {
          window.scrollTo({ top: scrollValue, behavior: 'instant' });
        }
      };
      
      // Immediate attempts
      restoreScroll();
      requestAnimationFrame(restoreScroll);
      
      // Delayed attempts to catch any late scroll events
      const timeouts = [0, 10, 50, 100, 200, 300].map(delay => 
        setTimeout(restoreScroll, delay)
      );
      
      // Clean up after restoration
      setTimeout(() => {
        sessionStorage.removeItem('adminPointsScroll');
        timeouts.forEach(clearTimeout);
      }, 400);
    }
  }, [daysParam, startDateParam, endDateParam, typeParam, minPointsParam, maxPointsParam, reasonParam, userEmailParam]);

  const handleQuickFilter = (days: number) => {
    const today = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    
    const updates: Record<string, string | null> = {
      days: days === 9999 ? '9999' : days.toString(),
      startDate: days === 9999 ? null : start.toISOString().split('T')[0],
      endDate: days === 9999 ? null : today.toISOString().split('T')[0],
    };
    
    navigateWithScrollPreservation(buildFilterUrl(updates));
  };

  const handleCustomDateRange = () => {
    if (!startDate) return;
    
    const updates: Record<string, string | null> = {
      days: null, // Clear days filter when using custom range
      startDate: startDate || null,
      endDate: endDate || null,
    };
    
    navigateWithScrollPreservation(buildFilterUrl(updates));
  };

  const handleTypeFilter = (newType: 'all' | 'earned' | 'spent') => {
    navigateWithScrollPreservation(buildFilterUrl({ type: newType === 'all' ? null : newType }));
  };

  const handlePointsRange = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    navigateWithScrollPreservation(buildFilterUrl({
      minPoints: minPoints || null,
      maxPoints: maxPoints || null,
    }), e);
  };

  const handleReasonSearch = () => {
    navigateWithScrollPreservation(buildFilterUrl({
      reason: reason || null,
    }));
  };

  const handleUserEmailSearch = () => {
    navigateWithScrollPreservation(buildFilterUrl({
      userEmail: userEmail || null,
    }));
  };

  const clearFilters = () => {
    navigateWithScrollPreservation('/admin/points?page=1');
  };

  const hasActiveFilters = !!(startDate || endDate || type !== 'all' || minPoints || maxPoints || reason || userEmail);

  // Determine if we're using custom date range vs quick filter
  const activeDaysFilter = daysParam ? parseInt(daysParam, 10) : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-gray-900">Filters</h2>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-gray-600 hover:text-gray-900 underline transition-colors"
            disabled={isPending}
          >
            Clear
          </button>
        )}
      </div>

      {/* Show loading indicator - fixed height to prevent layout shift */}
      <div className="h-5 mb-1 transition-opacity duration-200">
        {isPending && (
          <div className="text-xs text-gray-500 animate-pulse">
            Updating...
          </div>
        )}
      </div>

      <div className="space-y-3">
        {/* Quick Date Filters */}
        <div className="border-b pb-3">
          <h3 className="text-sm font-bold text-gray-900 mb-2">Time Period</h3>
          <div className="space-y-2">
            {[
              { days: 30, label: 'Last 30 days' },
              { days: 90, label: 'Last 90 days' },
              { days: 180, label: 'Last 6 months' },
              { days: 365, label: 'Last year' },
              { days: 9999, label: 'All time' },
            ].map(({ days, label }) => {
              const isSelected = activeDaysFilter === days;
              return (
                <button
                  key={days}
                  onClick={() => handleQuickFilter(days)}
                  disabled={isPending}
                  className={`block w-full text-left text-sm py-2 transition-colors ${
                    isSelected ? 'font-semibold text-gray-900' : 'text-gray-600 hover:text-gray-900'
                  } ${isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Date Range */}
        <div className="border-b pb-3">
          <h3 className="text-sm font-bold text-gray-900 mb-2">Custom Range</h3>
          <div className="space-y-2">
            <Input
              type="date"
              label="Start Date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              max={endDate || new Date().toISOString().split('T')[0]}
              disabled={isPending}
            />
            <Input
              type="date"
              label="End Date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              max={new Date().toISOString().split('T')[0]}
              disabled={isPending}
            />
            <button
              type="button"
              onClick={handleCustomDateRange}
              disabled={!startDate || isPending}
              className="w-full px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-primary text-white hover:bg-primary/90"
            >
              Apply Range
            </button>
          </div>
        </div>

        {/* User Email Filter */}
        <div className="border-b pb-3">
          <h3 className="text-sm font-bold text-gray-900 mb-2">User Email</h3>
          <div className="space-y-2">
            <Input
              type="text"
              label=""
              placeholder="Search by email..."
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isPending) {
                  e.preventDefault();
                  handleUserEmailSearch();
                }
              }}
              disabled={isPending}
            />
            <button
              type="button"
              onClick={handleUserEmailSearch}
              disabled={isPending}
              className="w-full px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-primary text-white hover:bg-primary/90"
            >
              Search
            </button>
          </div>
        </div>

        {/* Transaction Type Filter */}
        <div className="border-b pb-3">
          <h3 className="text-sm font-bold text-gray-900 mb-2">Type</h3>
          <div className="space-y-2">
            {[
              { value: 'all', label: 'All' },
              { value: 'earned', label: 'Earned Only' },
              { value: 'spent', label: 'Spent Only' },
            ].map(({ value, label }) => {
              const isSelected = type === value;
              return (
                <button
                  key={value}
                  onClick={() => handleTypeFilter(value as 'all' | 'earned' | 'spent')}
                  disabled={isPending}
                  className={`block w-full text-left text-sm py-2 transition-colors ${
                    isSelected ? 'font-semibold text-gray-900' : 'text-gray-600 hover:text-gray-900'
                  } ${isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Points Range Filter */}
        <div className="border-b pb-3">
          <h3 className="text-sm font-bold text-gray-900 mb-2">Points Range</h3>
          <div className="space-y-2">
            <Input
              type="number"
              label="Min Points"
              placeholder="0"
              value={minPoints}
              onChange={(e) => setMinPoints(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isPending) {
                  e.preventDefault();
                  handlePointsRange();
                }
              }}
              min="0"
              disabled={isPending}
            />
            <Input
              type="number"
              label="Max Points"
              placeholder="No limit"
              value={maxPoints}
              onChange={(e) => setMaxPoints(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isPending) {
                  e.preventDefault();
                  handlePointsRange();
                }
              }}
              min="0"
              disabled={isPending}
            />
            <button
              type="button"
              onClick={handlePointsRange}
              disabled={isPending}
              className="w-full px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-primary text-white hover:bg-primary/90"
            >
              Apply Range
            </button>
          </div>
        </div>

        {/* Reason Search */}
        <div>
          <h3 className="text-sm font-bold text-gray-900 mb-2">Search</h3>
          <div className="space-y-2">
            <Input
              type="text"
              label=""
              placeholder="Search by reason..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isPending) {
                  handleReasonSearch();
                }
              }}
              disabled={isPending}
            />
            <button
              type="button"
              onClick={handleReasonSearch}
              disabled={isPending}
              className="w-full px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-primary text-white hover:bg-primary/90"
            >
              Search
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

