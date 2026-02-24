'use client';

import { Button } from 'core/components/Button';
import { FilterDrawer } from 'core/components/FilterDrawer';
import Link from 'next/link';

const PERIODS = [
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
  { days: 180, label: 'Last 6 months' },
  { days: 365, label: 'Last year' },
  { days: 9999, label: 'All time' },
] as const;

interface OrdersPeriodFilterProps {
  currentDays: number;
}

export function OrdersPeriodFilter({ currentDays }: OrdersPeriodFilterProps) {
  const currentLabel = PERIODS.find((p) => p.days === currentDays)?.label ?? 'Period';

  const periodContent = (
    <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
      <span className="text-sm font-medium text-gray-900 lg:text-gray-600">Period:</span>
      {PERIODS.map(({ days, label }) => (
        <Link key={days} href={`/orders?days=${days}&page=1`} className="focus:outline-none">
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

