'use client';

import Link from 'next/link';

interface Transaction {
  id: string;
  delta_points: number;
  reason: string;
  order_id?: string | null;
  created_at: string;
  profiles?: {
    email: string;
  } | null;
}

interface TransactionRowProps {
  transaction: Transaction;
}

export function TransactionRow({ transaction }: TransactionRowProps) {
  const hasOrderLink = !!transaction.order_id;

  if (hasOrderLink && transaction.order_id) {
    return (
      <tr className="group">
        <td className="px-4 py-5 text-sm text-gray-900 group-hover:bg-blue-50 transition-colors">
          <Link href={`/admin/orders/${transaction.order_id}`} className="block">
            {transaction.profiles?.email || 'N/A'}
          </Link>
        </td>
        <td className="px-4 py-5 text-sm group-hover:bg-blue-50 transition-colors">
          <Link href={`/admin/orders/${transaction.order_id}`} className="block">
            <span
              className={`font-semibold ${
                transaction.delta_points > 0 ? 'text-green-700' : 'text-red-700'
              }`}
            >
              {transaction.delta_points > 0 ? '+' : ''}
              {transaction.delta_points}
            </span>
          </Link>
        </td>
        <td className="px-4 py-5 text-sm text-gray-800 group-hover:bg-blue-50 transition-colors">
          <Link href={`/admin/orders/${transaction.order_id}`} className="block">
            <div className="flex items-center gap-2">
              {transaction.reason}
              <svg 
                className="w-4 h-4 text-blue-600" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                aria-label="Linked to order"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M13 7l5 5m0 0l-5 5m5-5H6" 
                />
              </svg>
            </div>
          </Link>
        </td>
        <td className="px-4 py-5 text-sm text-gray-700 group-hover:bg-blue-50 transition-colors">
          <Link href={`/admin/orders/${transaction.order_id}`} className="block">
            {new Date(transaction.created_at).toLocaleString()}
          </Link>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="px-4 py-5 text-sm text-gray-900">
        {transaction.profiles?.email || 'N/A'}
      </td>
      <td className="px-4 py-5 text-sm">
        <span
          className={`font-semibold ${
            transaction.delta_points > 0 ? 'text-green-700' : 'text-red-700'
          }`}
        >
          {transaction.delta_points > 0 ? '+' : ''}
          {transaction.delta_points}
        </span>
      </td>
      <td className="px-4 py-5 text-sm text-gray-800">
        <div className="flex items-center gap-2">
          {transaction.reason}
        </div>
      </td>
      <td className="px-4 py-5 text-sm text-gray-700">
        {new Date(transaction.created_at).toLocaleString()}
      </td>
    </tr>
  );
}
