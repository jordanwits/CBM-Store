'use server';

import { requireAdmin } from '@/lib/auth/require-admin';
import { sendEmail } from '@/lib/email/resend';
import { pointsAdjustmentNotificationEmail } from '@/lib/email/templates';
import { revalidatePath } from 'next/cache';

export async function adjustUserPoints(
  userId: string,
  deltaPoints: number,
  reason: string,
  notifyUser: boolean = false
) {
  const { supabase, profile } = await requireAdmin();
  
  // Validate inputs
  if (!userId || !reason || reason.trim() === '') {
    return { success: false, error: 'User and reason are required' };
  }
  
  if (isNaN(deltaPoints) || deltaPoints === 0) {
    return { success: false, error: 'Points adjustment must be a non-zero number' };
  }
  
  // Verify user exists
  const { data: targetUser, error: userError } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .eq('id', userId)
    .single();
  
  if (userError || !targetUser) {
    return { success: false, error: 'User not found' };
  }
  
  // Insert into points ledger
  const { error } = await supabase
    .from('points_ledger')
    .insert({
      user_id: userId,
      delta_points: deltaPoints,
      reason: reason.trim(),
      created_by: profile.id,
    });
  
  if (error) {
    console.error('Error adjusting user points:', error);
    return { success: false, error: 'Failed to adjust points' };
  }

  // Send notification email if requested
  if (notifyUser && targetUser.email) {
    try {
      const emailResult = await sendEmail({
        to: targetUser.email,
        ...pointsAdjustmentNotificationEmail({
          recipientEmail: targetUser.email,
          recipientName: targetUser.full_name ?? undefined,
          deltaPoints,
          reason: reason.trim(),
        }),
      });
      if (!emailResult.success && !emailResult.skipped) {
        console.error('Failed to send points notification email:', emailResult.error);
      }
    } catch (emailErr) {
      console.error('Error sending points notification email:', emailErr);
    }
  }
  
  // Revalidate relevant pages
  revalidatePath('/admin/points');
  revalidatePath('/admin/users');
  revalidatePath('/dashboard');
  revalidatePath('/points-history');
  
  const baseMessage = `Successfully ${deltaPoints > 0 ? 'added' : 'deducted'} ${Math.abs(deltaPoints)} points ${deltaPoints > 0 ? 'to' : 'from'} ${targetUser.email}`;
  const message = notifyUser ? `${baseMessage} and notified user by email.` : baseMessage;
  return { success: true, message };
}

export async function getUsers() {
  const { supabase } = await requireAdmin();
  
  // Fetch all active users including admins
  // Using service role client, so RLS is bypassed
  const { data: users, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, active, role')
    .eq('active', true)
    .order('email');
  
  if (error) {
    console.error('Error fetching users:', error);
    return [];
  }
  
  console.log('Fetched users for points adjustment:', users?.length || 0);
  return users || [];
}

interface BulkPointsResult {
  success: boolean;
  error?: string;
  summary?: {
    total: number;
    successful: number;
    failed: number;
    failures: Array<{ row: number; email: string; error: string }>;
  };
}

function parseCSVRow(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field delimiter
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

export async function bulkAdjustPointsFromCsv(formData: FormData): Promise<BulkPointsResult> {
  // Check if using placeholder Supabase (dev mode)
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  
  if (isDevMode) {
    return { 
      success: false, 
      error: 'Bulk points upload requires Supabase to be configured.' 
    };
  }

  const { supabase, profile } = await requireAdmin();
  
  const file = formData.get('csv') as File;
  if (!file) {
    return { success: false, error: 'No file uploaded' };
  }
  
  if (!file.name.endsWith('.csv')) {
    return { success: false, error: 'File must be a CSV' };
  }
  
  try {
    const text = await file.text();
    // Handle Windows (CRLF), Unix (LF), and Mac (CR) line endings
    const lines = text.split(/\r\n|\n|\r/).filter(line => line.trim());
    
    if (lines.length === 0) {
      return { success: false, error: 'CSV file is empty' };
    }
    
    // Check for header row
    const header = parseCSVRow(lines[0]);
    const hasHeader = header[0].toLowerCase() === 'email' || 
                      header.some(h => h.toLowerCase().includes('email'));
    
    const dataLines = hasHeader ? lines.slice(1) : lines;
    
    if (dataLines.length === 0) {
      return { success: false, error: 'No data rows found in CSV' };
    }
    
    const failures: Array<{ row: number; email: string; error: string }> = [];
    let successful = 0;
    
    // Process each row
    for (let i = 0; i < dataLines.length; i++) {
      const rowNumber = hasHeader ? i + 2 : i + 1;
      const line = dataLines[i].trim();
      
      if (!line) continue;
      
      const fields = parseCSVRow(line);
      
      if (fields.length < 2) {
        failures.push({
          row: rowNumber,
          email: fields[0] || 'unknown',
          error: 'Missing required fields (email, delta_points)',
        });
        continue;
      }
      
      const email = fields[0].trim();
      const deltaPointsStr = fields[1].trim();
      const reason = fields[2]?.trim() || 'Bulk points adjustment';
      
      // Validate email
      if (!email || !email.includes('@')) {
        failures.push({
          row: rowNumber,
          email,
          error: 'Invalid email address',
        });
        continue;
      }
      
      // Validate points
      const deltaPoints = parseInt(deltaPointsStr, 10);
      if (isNaN(deltaPoints) || deltaPoints === 0) {
        failures.push({
          row: rowNumber,
          email,
          error: 'Invalid points value (must be non-zero number)',
        });
        continue;
      }
      
      // Look up user by email
      const { data: user, error: userError } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('email', email)
        .single();
      
      if (userError || !user) {
        failures.push({
          row: rowNumber,
          email,
          error: 'User not found',
        });
        continue;
      }
      
      // Insert points adjustment
      const { error: insertError } = await supabase
        .from('points_ledger')
        .insert({
          user_id: user.id,
          delta_points: deltaPoints,
          reason,
          created_by: profile.id,
        });
      
      if (insertError) {
        console.error('Error inserting points:', insertError);
        failures.push({
          row: rowNumber,
          email,
          error: 'Failed to insert points adjustment',
        });
        continue;
      }
      
      successful++;
    }
    
    // Revalidate relevant pages
    revalidatePath('/admin/points');
    revalidatePath('/admin/users');
    revalidatePath('/dashboard');
    revalidatePath('/points-history');
    
    return {
      success: true,
      summary: {
        total: dataLines.length,
        successful,
        failed: failures.length,
        failures,
      },
    };
  } catch (error) {
    console.error('Error processing CSV:', error);
    return { 
      success: false, 
      error: 'Failed to process CSV file. Please check the format.' 
    };
  }
}