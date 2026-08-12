/**
 * CSV generation and export utilities
 * Handles conversion of database records to CSV format with proper escaping
 */

import { unitsToMake } from '@/lib/orders/fulfillment';

/**
 * Escape a CSV field value
 * Handles quotes, commas, and newlines
 */
function escapeCsvField(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  const strValue = String(value);
  
  // If value contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n') || strValue.includes('\r')) {
    return `"${strValue.replace(/"/g, '""')}"`;
  }
  
  return strValue;
}

/**
 * Convert array of objects to CSV string
 */
export function arrayToCsv(data: any[], headers: string[]): string {
  if (data.length === 0) {
    return headers.join(',') + '\n';
  }
  
  // Header row
  const headerRow = headers.map(escapeCsvField).join(',');
  
  // Data rows
  const dataRows = data.map(row => {
    return headers.map(header => {
      return escapeCsvField(row[header]);
    }).join(',');
  });
  
  return [headerRow, ...dataRows].join('\n');
}

/**
 * Generate orders export CSV
 */
export function generateOrdersCsv(orders: any[]): string {
  const headers = [
    'id',
    'user_id',
    'status',
    'total_points',
    'delivery_method',
    'ship_name',
    'ship_address_line1',
    'ship_address_line2',
    'ship_city',
    'ship_state',
    'ship_zip',
    'ship_country',
    'tracking_number',
    'notes',
    'created_at',
    'updated_at',
  ];
  
  return arrayToCsv(orders, headers);
}

/**
 * Generate order items export CSV
 */
export function generateOrderItemsCsv(orderItems: any[]): string {
  const headers = [
    'id',
    'order_id',
    'product_id',
    'variant_id',
    'product_name',
    'variant_name',
    'variant_size',
    'variant_color',
    'quantity',
    'units_from_stock',
    'units_to_make',
    'made_to_order',
    'fulfillment_status',
    'points_per_item',
    'total_points',
    'created_at',
  ];

  // units_to_make is the one column here nobody can work out at a glance, since a
  // made-to-order line can be partly pulled from stock. Derived at export time from the
  // same rule the admin order table uses, so the CSV and the screen cannot disagree.
  const rows = orderItems.map((item) => ({
    ...item,
    units_to_make: unitsToMake(item),
  }));

  return arrayToCsv(rows, headers);
}

export interface InventorySnapshotProduct {
  id: string;
  name: string;
  active: boolean;
  made_to_order?: boolean | null;
  base_usd: number | string;
}

export interface InventorySnapshotVariant {
  id: string;
  product_id: string;
  name: string | null;
  size: string | null;
  color: string | null;
  sku: string | null;
  active: boolean;
  inventory_count: number | null;
  price_adjustment_usd: number | string | null;
  updated_at: string | null;
}

/**
 * Flatten the catalog into one row per sellable line for an inventory snapshot.
 *
 * Stock lives only on product_variants.inventory_count, so a product with no variants has
 * nowhere to hold a number at all. Those still get a row — omitting them would make the
 * file impossible to reconcile against the catalog — marked stock_tracked false with
 * units_on_hand left blank. Blank and 0 are genuinely different here: a NULL count means
 * the storefront never gates the variant on stock, while 0 means it is sold out.
 */
export function buildInventorySnapshotRows(
  products: InventorySnapshotProduct[],
  variants: InventorySnapshotVariant[],
  conversionRate: number,
  snapshotAt: string
): any[] {
  const variantsByProduct = new Map<string, InventorySnapshotVariant[]>();
  for (const variant of variants) {
    const forProduct = variantsByProduct.get(variant.product_id);
    if (forProduct) {
      forProduct.push(variant);
    } else {
      variantsByProduct.set(variant.product_id, [variant]);
    }
  }

  // Points are rounded per component, matching place_points_order, so the export and the
  // storefront quote the same number rather than drifting by a point on odd prices.
  const toPoints = (usd: number | string | null | undefined) =>
    Math.round(Number(usd ?? 0) * conversionRate);

  const rows: any[] = [];

  const sortedProducts = [...products].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '')
  );

  for (const product of sortedProducts) {
    const basePoints = toPoints(product.base_usd);
    const productFields = {
      product_id: product.id,
      product_name: product.name,
      product_active: product.active,
      made_to_order: product.made_to_order ?? false,
      base_usd: product.base_usd,
      snapshot_at: snapshotAt,
    };

    const productVariants = (variantsByProduct.get(product.id) || []).sort((a, b) =>
      (a.name || '').localeCompare(b.name || '')
    );

    if (productVariants.length === 0) {
      rows.push({
        ...productFields,
        variant_id: '',
        variant_name: '',
        variant_size: '',
        variant_color: '',
        sku: '',
        variant_active: '',
        stock_tracked: false,
        units_on_hand: '',
        price_adjustment_usd: '',
        points_price: basePoints,
        variant_updated_at: '',
      });
      continue;
    }

    for (const variant of productVariants) {
      const tracked = variant.inventory_count !== null && variant.inventory_count !== undefined;

      rows.push({
        ...productFields,
        variant_id: variant.id,
        variant_name: variant.name,
        variant_size: variant.size,
        variant_color: variant.color,
        sku: variant.sku,
        variant_active: variant.active,
        stock_tracked: tracked,
        units_on_hand: tracked ? variant.inventory_count : '',
        price_adjustment_usd: variant.price_adjustment_usd,
        points_price: basePoints + toPoints(variant.price_adjustment_usd),
        variant_updated_at: variant.updated_at,
      });
    }
  }

  return rows;
}

/**
 * Generate inventory snapshot export CSV
 */
export function generateInventoryCsv(rows: any[]): string {
  const headers = [
    'product_name',
    'variant_name',
    'variant_size',
    'variant_color',
    'sku',
    'units_on_hand',
    'stock_tracked',
    'product_active',
    'variant_active',
    'made_to_order',
    'points_price',
    'base_usd',
    'price_adjustment_usd',
    'variant_updated_at',
    'snapshot_at',
    'product_id',
    'variant_id',
  ];

  return arrayToCsv(rows, headers);
}

/**
 * Generate points ledger export CSV
 */
export function generatePointsLedgerCsv(transactions: any[]): string {
  const headers = [
    'id',
    'user_id',
    'delta_points',
    'reason',
    'order_id',
    'created_by',
    'created_at',
  ];
  
  return arrayToCsv(transactions, headers);
}

/**
 * Get file size in bytes for a string
 */
export function getFileSizeBytes(content: string): number {
  return new Blob([content]).size;
}
