/**
 * CSV generation and export utilities
 * Handles conversion of database records to CSV format with proper escaping
 */

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
    'quantity',
    'points_per_item',
    'total_points',
    'created_at',
  ];
  
  return arrayToCsv(orderItems, headers);
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
