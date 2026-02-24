'use server';

import { requireAdmin } from '@/lib/auth/require-admin';
import { revalidatePath } from 'next/cache';
import {
  generateOrdersCsv,
  generateOrderItemsCsv,
  generatePointsLedgerCsv,
  getFileSizeBytes,
} from '@/lib/exports/csv-generator';

interface ExportResult {
  success: boolean;
  error?: string;
  message?: string;
  exportId?: string;
}

/**
 * Format a YYYY-MM month string to a human-readable format (e.g., "January 2025")
 */
function formatMonthName(month: string): string {
  const [year, monthNum] = month.split('-');
  const monthIndex = parseInt(monthNum, 10) - 1; // Convert to 0-indexed
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return `${monthNames[monthIndex]} ${year}`;
}

/**
 * Generate monthly export for a specific month and type
 * @param month - YYYY-MM format
 * @param exportType - 'orders', 'order_items', or 'points_ledger'
 */
export async function generateMonthlyExport(
  month: string,
  exportType: 'orders' | 'order_items' | 'points_ledger'
): Promise<ExportResult> {
  // Check if using placeholder Supabase (dev mode)
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  
  if (isDevMode) {
    return { 
      success: false, 
      error: 'Export generation is not available in development mode. Please configure Supabase to use this feature.' 
    };
  }

  try {
    const { supabase, profile } = await requireAdmin();

    // Validate month format
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return { 
        success: false, 
        error: `Invalid month format: "${month}". Please use the format YYYY-MM (e.g., 2025-12).` 
      };
    }

    // Parse month to get date range
    const [year, monthNum] = month.split('-');
    const startDate = new Date(`${year}-${monthNum}-01T00:00:00Z`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    // Allow duplicate exports - users can regenerate exports for the same month/type
    // If they want to replace an existing export, they can delete it first or generate a new one

    let csvContent: string;
    let rowCount: number;

    // Generate export based on type
    if (exportType === 'orders') {
      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lt('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });

      if (!orders || orders.length === 0) {
        const monthName = formatMonthName(month);
        return { 
          success: false, 
          error: `No orders found for ${monthName} (${month}). There may not have been any orders placed during this period.` 
        };
      }

      csvContent = generateOrdersCsv(orders);
      rowCount = orders.length;
    } else if (exportType === 'order_items') {
      // Get order items for orders in this month
      const { data: orderItems } = await supabase
        .from('order_items')
        .select(`
          *,
          orders!inner(created_at)
        `)
        .gte('orders.created_at', startDate.toISOString())
        .lt('orders.created_at', endDate.toISOString())
        .order('created_at', { ascending: true });

      if (!orderItems || orderItems.length === 0) {
        const monthName = formatMonthName(month);
        return { 
          success: false, 
          error: `No order items found for ${monthName} (${month}). There may not have been any orders with items during this period.` 
        };
      }

      csvContent = generateOrderItemsCsv(orderItems);
      rowCount = orderItems.length;
    } else if (exportType === 'points_ledger') {
      const { data: transactions } = await supabase
        .from('points_ledger')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lt('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });

      if (!transactions || transactions.length === 0) {
        const monthName = formatMonthName(month);
        return { 
          success: false, 
          error: `No points transactions found for ${monthName} (${month}). There may not have been any points activity during this period.` 
        };
      }

      csvContent = generatePointsLedgerCsv(transactions);
      rowCount = transactions.length;
    } else {
      return { 
        success: false, 
        error: `Invalid export type: "${exportType}". Valid types are: orders, order_items, or points_ledger.` 
      };
    }

    // Upload to storage
    // Use a timestamped filename to allow multiple exports for the same month/type
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5); // Format: 2026-01-15T10-30-45
    const fileName = `${month}_${exportType}_${timestamp}.csv`;
    const fileSizeBytes = getFileSizeBytes(csvContent);
    
    const { error: uploadError } = await supabase.storage
      .from('exports')
      .upload(fileName, csvContent, {
        contentType: 'text/csv',
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return { 
        success: false, 
        error: `Failed to upload export file to storage: ${uploadError.message}. Please check your storage configuration and try again.` 
      };
    }

    // Insert metadata record
    const { data: exportRecord, error: insertError } = await supabase
      .from('monthly_exports')
      .insert({
        month,
        export_type: exportType,
        storage_path: fileName,
        file_size_bytes: fileSizeBytes,
        row_count: rowCount,
        created_by: profile.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting export metadata:', insertError);
      // Try to clean up the uploaded file
      await supabase.storage.from('exports').remove([fileName]);
      return { 
        success: false, 
        error: `Failed to save export metadata: ${insertError.message}. The file was uploaded but the export record could not be created. Please try again.` 
      };
    }

    // Revalidate the page cache (wrap in try-catch to prevent errors from affecting response)
    try {
      revalidatePath('/admin/exports');
    } catch (revalidateError) {
      console.warn('Error revalidating path (non-critical):', revalidateError);
    }

    // Ensure return value is always a plain serializable object
    // Convert exportId to string to ensure proper serialization
    return { 
      success: true, 
      message: `Successfully exported ${rowCount} rows for ${month} (${exportType})`,
      exportId: String(exportRecord.id),
    };
  } catch (error) {
    console.error('Error generating export:', error);
    
    // Ensure we always return a serializable error object
    // Don't let Next.js redirect errors or other special errors propagate
    if (error && typeof error === 'object' && 'digest' in error) {
      const digest = (error as any).digest;
      // Handle Next.js redirect errors
      if (typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT')) {
        return { 
          success: false, 
          error: 'Your session has expired or you do not have permission to perform this action. Please refresh the page and log in again.' 
        };
      }
    }
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : typeof error === 'string' 
        ? error 
        : 'An unexpected error occurred while generating the export. Please try again or contact support if the problem persists.';
    
    return { 
      success: false, 
      error: errorMessage 
    };
  }
}

/**
 * Delete an export
 */
export async function deleteExport(exportId: string): Promise<ExportResult> {
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  
  if (isDevMode) {
    return { 
      success: false, 
      error: 'Exports require Supabase to be configured.' 
    };
  }

  try {
    const { supabase } = await requireAdmin();

    // Get export metadata
    const { data: exportRecord, error: fetchError } = await supabase
      .from('monthly_exports')
      .select('storage_path')
      .eq('id', exportId)
      .single();

    if (fetchError || !exportRecord) {
      return { 
        success: false, 
        error: `Export not found. The export with ID "${exportId}" may have already been deleted or does not exist.` 
      };
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('exports')
      .remove([exportRecord.storage_path]);

    if (storageError) {
      console.error('Storage delete error:', storageError);
      // Continue anyway to clean up metadata
    }

    // Delete metadata
    const { error: deleteError } = await supabase
      .from('monthly_exports')
      .delete()
      .eq('id', exportId);

    if (deleteError) {
      console.error('Error deleting export metadata:', deleteError);
      return { 
        success: false, 
        error: `Failed to delete export: ${deleteError.message}. The file may have been removed from storage, but the export record could not be deleted.` 
      };
    }

    revalidatePath('/admin/exports');

    return { 
      success: true, 
      message: 'Export deleted successfully. The file and export record have been removed.' 
    };
  } catch (error) {
    console.error('Error deleting export:', error);
    const errorMessage = error instanceof Error 
      ? error.message 
      : typeof error === 'string' 
        ? error 
        : 'An unexpected error occurred while deleting the export. Please try again or contact support if the problem persists.';
    
    return { 
      success: false, 
      error: errorMessage 
    };
  }
}

/**
 * Get list of all exports
 */
export async function getExports() {
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  
  if (isDevMode) {
    return [];
  }

  try {
    const { supabase } = await requireAdmin();

    const { data: exports } = await supabase
      .from('monthly_exports')
      .select(`
        *,
        profiles(email)
      `)
      .order('month', { ascending: false });

    return exports || [];
  } catch (error) {
    console.error('Error fetching exports:', error);
    // Return empty array on error to prevent UI crashes
    // The error is logged for debugging but we don't want to break the UI
    return [];
  }
}

/**
 * Generate combined export for multiple months
 * @param startMonth - YYYY-MM format (first month)
 * @param endMonth - YYYY-MM format (last month)
 * @param exportType - 'orders', 'order_items', or 'points_ledger'
 */
export async function generateCombinedExport(
  startMonth: string,
  endMonth: string,
  exportType: 'orders' | 'order_items' | 'points_ledger'
): Promise<ExportResult> {
  // Check if using placeholder Supabase (dev mode)
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  
  if (isDevMode) {
    return { 
      success: false, 
      error: 'Export generation is not available in development mode. Please configure Supabase to use this feature.' 
    };
  }

  try {
    const { supabase, profile } = await requireAdmin();

    // Validate month formats
    if (!/^\d{4}-\d{2}$/.test(startMonth) || !/^\d{4}-\d{2}$/.test(endMonth)) {
      return { 
        success: false, 
        error: `Invalid month format. Please use the format YYYY-MM (e.g., 2025-12).` 
      };
    }

    // Parse months to get date range
    const [startYear, startMonthNum] = startMonth.split('-');
    const [endYear, endMonthNum] = endMonth.split('-');
    const startDate = new Date(`${startYear}-${startMonthNum}-01T00:00:00Z`);
    const endDate = new Date(`${endYear}-${endMonthNum}-01T00:00:00Z`);
    endDate.setMonth(endDate.getMonth() + 1); // End of the last month

    let csvContent: string;
    let rowCount: number;

    // Generate export based on type (combining all months)
    if (exportType === 'orders') {
      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lt('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });

      if (!orders || orders.length === 0) {
        const startMonthName = formatMonthName(startMonth);
        const endMonthName = formatMonthName(endMonth);
        return { 
          success: false, 
          error: `No orders found for the period ${startMonthName} to ${endMonthName}.` 
        };
      }

      csvContent = generateOrdersCsv(orders);
      rowCount = orders.length;
    } else if (exportType === 'order_items') {
      const { data: orderItems } = await supabase
        .from('order_items')
        .select(`
          *,
          orders!inner(created_at)
        `)
        .gte('orders.created_at', startDate.toISOString())
        .lt('orders.created_at', endDate.toISOString())
        .order('created_at', { ascending: true });

      if (!orderItems || orderItems.length === 0) {
        const startMonthName = formatMonthName(startMonth);
        const endMonthName = formatMonthName(endMonth);
        return { 
          success: false, 
          error: `No order items found for the period ${startMonthName} to ${endMonthName}.` 
        };
      }

      csvContent = generateOrderItemsCsv(orderItems);
      rowCount = orderItems.length;
    } else if (exportType === 'points_ledger') {
      const { data: transactions } = await supabase
        .from('points_ledger')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lt('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });

      if (!transactions || transactions.length === 0) {
        const startMonthName = formatMonthName(startMonth);
        const endMonthName = formatMonthName(endMonth);
        return { 
          success: false, 
          error: `No points transactions found for the period ${startMonthName} to ${endMonthName}.` 
        };
      }

      csvContent = generatePointsLedgerCsv(transactions);
      rowCount = transactions.length;
    } else {
      return { 
        success: false, 
        error: `Invalid export type: "${exportType}". Valid types are: orders, order_items, or points_ledger.` 
      };
    }

    // Upload to storage with combined month range in filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const fileName = `${startMonth}_to_${endMonth}_${exportType}_${timestamp}.csv`;
    const fileSizeBytes = getFileSizeBytes(csvContent);
    
    const { error: uploadError } = await supabase.storage
      .from('exports')
      .upload(fileName, csvContent, {
        contentType: 'text/csv',
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return { 
        success: false, 
        error: `Failed to upload export file to storage: ${uploadError.message}. Please check your storage configuration and try again.` 
      };
    }

    // Insert metadata record (use startMonth as the month field for combined exports)
    const { data: exportRecord, error: insertError } = await supabase
      .from('monthly_exports')
      .insert({
        month: `${startMonth}_to_${endMonth}`, // Store range in month field
        export_type: exportType,
        storage_path: fileName,
        file_size_bytes: fileSizeBytes,
        row_count: rowCount,
        created_by: profile.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting export metadata:', insertError);
      await supabase.storage.from('exports').remove([fileName]);
      return { 
        success: false, 
        error: `Failed to save export metadata: ${insertError.message}. The file was uploaded but the export record could not be created. Please try again.` 
      };
    }

    // Revalidate the page cache
    try {
      revalidatePath('/admin/exports');
    } catch (revalidateError) {
      console.warn('Error revalidating path (non-critical):', revalidateError);
    }

    const startMonthName = formatMonthName(startMonth);
    const endMonthName = formatMonthName(endMonth);
    return { 
      success: true, 
      message: `Successfully exported ${rowCount} rows for ${startMonthName} to ${endMonthName} (${exportType})`,
      exportId: String(exportRecord.id),
    };
  } catch (error) {
    console.error('Error generating combined export:', error);
    
    if (error && typeof error === 'object' && 'digest' in error) {
      const digest = (error as any).digest;
      if (typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT')) {
        return { 
          success: false, 
          error: 'Your session has expired or you do not have permission to perform this action. Please refresh the page and log in again.' 
        };
      }
    }
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : typeof error === 'string' 
        ? error 
        : 'An unexpected error occurred while generating the export. Please try again or contact support if the problem persists.';
    
    return { 
      success: false, 
      error: errorMessage 
    };
  }
}

/**
 * Generate signed URL for downloading an export
 */
export async function getExportDownloadUrl(exportId: string): Promise<{ url?: string; error?: string }> {
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  
  if (isDevMode) {
    return { error: 'Export downloads are not available in development mode. Please configure Supabase to use this feature.' };
  }

  try {
    const { supabase } = await requireAdmin();

    // Get export metadata
    const { data: exportRecord, error: fetchError } = await supabase
      .from('monthly_exports')
      .select('storage_path')
      .eq('id', exportId)
      .single();

    if (fetchError || !exportRecord) {
      return { 
        error: `Export not found. The export with ID "${exportId}" may have been deleted or does not exist.` 
      };
    }

    // Generate signed URL (valid for 1 hour)
    const { data, error: urlError } = await supabase.storage
      .from('exports')
      .createSignedUrl(exportRecord.storage_path, 3600);

    if (urlError || !data) {
      console.error('Error generating signed URL:', urlError);
      return { 
        error: `Failed to generate download URL: ${urlError?.message || 'Unknown error'}. The export file may be missing or inaccessible.` 
      };
    }

    return { url: data.signedUrl };
  } catch (error) {
    console.error('Error generating download URL:', error);
    const errorMessage = error instanceof Error 
      ? error.message 
      : typeof error === 'string' 
        ? error 
        : 'An unexpected error occurred while generating the download URL. Please try again or contact support if the problem persists.';
    
    return { error: errorMessage };
  }
}
