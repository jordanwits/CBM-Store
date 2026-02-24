import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Monthly Export Edge Function
 * 
 * Automatically generates CSV exports for orders, order_items, and points_ledger
 * for the previous month. Intended to be called by pg_cron on the first of each month.
 * 
 * Security: Requires X-Cron-Secret header matching CRON_SECRET env var
 */

interface ExportResult {
  success: boolean;
  type: string;
  rowCount?: number;
  fileSize?: number;
  error?: string;
}

// CSV generation utilities (copied from lib/exports/csv-generator.ts)
function escapeCsvField(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  const strValue = String(value);
  
  if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n') || strValue.includes('\r')) {
    return `"${strValue.replace(/"/g, '""')}"`;
  }
  
  return strValue;
}

function arrayToCsv(data: any[], headers: string[]): string {
  if (data.length === 0) {
    return headers.join(',') + '\n';
  }
  
  const headerRow = headers.map(escapeCsvField).join(',');
  
  const dataRows = data.map(row => {
    return headers.map(header => {
      return escapeCsvField(row[header]);
    }).join(',');
  });
  
  return [headerRow, ...dataRows].join('\n');
}

function generateOrdersCsv(orders: any[]): string {
  const headers = [
    'id', 'user_id', 'status', 'total_points', 'delivery_method',
    'ship_name', 'ship_address_line1', 'ship_address_line2',
    'ship_city', 'ship_state', 'ship_zip', 'ship_country',
    'tracking_number', 'notes', 'created_at', 'updated_at',
  ];
  return arrayToCsv(orders, headers);
}

function generateOrderItemsCsv(orderItems: any[]): string {
  const headers = [
    'id', 'order_id', 'product_id', 'variant_id',
    'product_name', 'variant_name', 'quantity',
    'points_per_item', 'total_points', 'created_at',
  ];
  return arrayToCsv(orderItems, headers);
}

function generatePointsLedgerCsv(transactions: any[]): string {
  const headers = [
    'id', 'user_id', 'delta_points', 'reason',
    'order_id', 'created_by', 'created_at',
  ];
  return arrayToCsv(transactions, headers);
}

async function generateExport(
  supabase: any,
  month: string,
  exportType: string,
  startDate: Date,
  endDate: Date
): Promise<ExportResult> {
  try {
    // Check if export already exists
    const { data: existing } = await supabase
      .from('monthly_exports')
      .select('id')
      .eq('month', month)
      .eq('export_type', exportType)
      .single();

    if (existing) {
      return { 
        success: false, 
        type: exportType,
        error: `Export already exists for ${month}` 
      };
    }

    let csvContent: string;
    let rowCount: number;
    let data: any[];

    // Generate export based on type
    if (exportType === 'orders') {
      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lt('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });

      data = orders || [];
      if (data.length === 0) {
        return { success: false, type: exportType, error: 'No data found' };
      }

      csvContent = generateOrdersCsv(data);
      rowCount = data.length;
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

      data = orderItems || [];
      if (data.length === 0) {
        return { success: false, type: exportType, error: 'No data found' };
      }

      csvContent = generateOrderItemsCsv(data);
      rowCount = data.length;
    } else if (exportType === 'points_ledger') {
      const { data: transactions } = await supabase
        .from('points_ledger')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lt('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });

      data = transactions || [];
      if (data.length === 0) {
        return { success: false, type: exportType, error: 'No data found' };
      }

      csvContent = generatePointsLedgerCsv(data);
      rowCount = data.length;
    } else {
      return { success: false, type: exportType, error: 'Invalid export type' };
    }

    // Upload to storage
    const fileName = `${month}_${exportType}.csv`;
    const fileSizeBytes = new Blob([csvContent]).size;
    
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
        type: exportType,
        error: `Upload failed: ${uploadError.message}` 
      };
    }

    // Insert metadata record (created_by is null for automated exports)
    const { error: insertError } = await supabase
      .from('monthly_exports')
      .insert({
        month,
        export_type: exportType,
        storage_path: fileName,
        file_size_bytes: fileSizeBytes,
        row_count: rowCount,
        created_by: null,
      });

    if (insertError) {
      console.error('Error inserting export metadata:', insertError);
      // Try to clean up the uploaded file
      await supabase.storage.from('exports').remove([fileName]);
      return { 
        success: false, 
        type: exportType,
        error: 'Failed to save metadata' 
      };
    }

    return { 
      success: true, 
      type: exportType,
      rowCount,
      fileSize: fileSizeBytes,
    };
  } catch (error) {
    console.error(`Error generating ${exportType} export:`, error);
    return { 
      success: false, 
      type: exportType,
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

Deno.serve(async (req: Request) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Verify cron secret
    const cronSecret = req.headers.get('X-Cron-Secret');
    const expectedSecret = Deno.env.get('CRON_SECRET');
    
    if (!expectedSecret) {
      console.error('CRON_SECRET not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (cronSecret !== expectedSecret) {
      console.error('Invalid cron secret provided');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body for optional month override
    let targetMonth: string;
    try {
      const body = await req.json();
      targetMonth = body.month;
    } catch {
      // No body or invalid JSON - use default (previous month)
      targetMonth = '';
    }

    // Calculate target month (default: previous month)
    let startDate: Date;
    let endDate: Date;
    
    if (targetMonth && /^\d{4}-\d{2}$/.test(targetMonth)) {
      // Use specified month
      const [year, monthNum] = targetMonth.split('-');
      startDate = new Date(`${year}-${monthNum}-01T00:00:00Z`);
      endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);
    } else {
      // Use previous month
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      startDate = new Date(Date.UTC(lastMonth.getFullYear(), lastMonth.getMonth(), 1));
      endDate = new Date(Date.UTC(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 1));
      
      targetMonth = `${startDate.getUTCFullYear()}-${String(startDate.getUTCMonth() + 1).padStart(2, '0')}`;
    }

    console.log(`Generating exports for ${targetMonth}`);
    console.log(`Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate all three export types
    const results: ExportResult[] = await Promise.all([
      generateExport(supabase, targetMonth, 'orders', startDate, endDate),
      generateExport(supabase, targetMonth, 'order_items', startDate, endDate),
      generateExport(supabase, targetMonth, 'points_ledger', startDate, endDate),
    ]);

    // Count successes and failures
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    const response = {
      month: targetMonth,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      summary: {
        total: results.length,
        successful: successful.length,
        failed: failed.length,
      },
      results,
    };

    console.log('Export summary:', response.summary);

    return new Response(
      JSON.stringify(response),
      { 
        status: failed.length > 0 ? 207 : 200,  // 207 Multi-Status if any failed
        headers: { 
          'Content-Type': 'application/json',
          'Connection': 'keep-alive',
        } 
      }
    );
  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
