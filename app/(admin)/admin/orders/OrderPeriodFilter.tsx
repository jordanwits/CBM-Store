'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from 'core/components/Button';
import { FilterDrawer } from 'core/components/FilterDrawer';
import Link from 'next/link';

const STORAGE_KEY = 'admin-orders-period';

const PERIODS = [
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
  { days: 180, label: 'Last 6 months' },
  { days: 365, label: 'Last year' },
  { days: 9999, label: 'All time' },
] as const;

interface OrderPeriodFilterProps {
  currentDays: number;
}

export function OrderPeriodFilter({ currentDays }: OrderPeriodFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // When no period in URL, redirect to last used period so selection "stays"
  useEffect(() => {
    const daysParam = searchParams.get('days');
    if (daysParam !== null) return; // URL already has a period
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const value = parseInt(saved, 10);
        if ([30, 90, 180, 365, 9999].includes(value)) {
          router.replace(`/admin/orders?days=${value}&page=1`);
        }
      }
    } catch {
      // ignore
    }
  }, [searchParams, router]);

  const saveAndNavigate = (days: number) => {
    try {
      sessionStorage.setItem(STORAGE_KEY, String(days));
    } catch {
      // ignore
    }
  };

  const currentLabel = PERIODS.find((p) => p.days === currentDays)?.label ?? 'Period';

  const periodContent = (
    <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
      <span className="text-sm font-medium text-gray-900 lg:text-gray-600">Period:</span>
      {PERIODS.map(({ days, label }) => (
        <Link
          key={days}
          href={`/admin/orders?days=${days}&page=1`}
          onClick={() => saveAndNavigate(days)}
          className="focus:outline-none"
        >
          <Button
            variant={currentDays === days ? 'primary' : 'outline'}
            size="sm"
            className="w-full justify-center lg:w-auto focus:ring-0 focus:ring-offset-0"
          >
            {label}
          </Button>
        </Link>
      ))}
    </div>
  );

  return (
    <FilterDrawer triggerLabel={currentLabel} inline>
      {periodContent}
    </FilterDrawer>
  );
}

