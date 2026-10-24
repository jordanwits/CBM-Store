'use server';

import { requireAdmin } from '@/lib/auth/require-admin';
import { sendEmail, deliverableEmail } from '@/lib/email/resend';
import { pointsAdjustmentNotificationEmail } from '@/lib/email/templates';
import { parsePointsBalancesRpc } from '@/lib/points/buckets';
import { parseBulkPointsCsv } from '@/lib/points/bulk-csv';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { revalidatePath } from 'next/cache';

export type PointBucketType = 'universal' | 'restricted';

const BUCKET_LABEL: Record<PointBucketType, string> = {
  universal: 'universal',
  restricted: 'CBM',
};

/**
 * Why a deduction can't go ahead, or null when it can. Taking more than a bucket holds is
 * almost always the wrong bucket or a stale balance, and leaves the customer unable to spend
 * from that bucket until it is topped back up.
 */
async function overdrawnBucketError(
  supabase: Awaited<ReturnType<typeof requireAdmin>>['supabase'],
  userId: string,
  deltaPoints: number,
  bucket: PointBucketType
): Promise<string | null> {
  if (deltaPoints >= 0) return null;

  const { data, error } = await supabase.rpc('get_user_points_balances', { p_user_id: userId });
  if (error) {
    console.error('Error reading points balance before a deduction:', error);
    return 'Could not check the balance, so nothing was deducted';
  }

  const balance = parsePointsBalancesRpc(data)[bucket];
  if (balance + deltaPoints >= 0) return null;

  const label = BUCKET_LABEL[bucket];
  return balance > 0
    ? `Only ${balance} ${label} points to deduct from, so ${-deltaPoints} can't be taken`
    : `No ${label} points to deduct from`;
}

export async function adjustUserPoints(
  userId: string,
  deltaPoints: number,
  reason: string,
  notifyUser: boolean = false,
  pointType: PointBucketType = 'universal'
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
    .select('id, email, phone, full_name')
    .eq('id', userId)
    .single();
  
  if (userError || !targetUser) {
    return { success: false, error: 'User not found' };
  }
  
  const bucket: PointBucketType = pointType === 'restricted' ? 'restricted' : 'universal';

  const overdrawn = await overdrawnBucketError(supabase, userId, deltaPoints, bucket);
  if (overdrawn) {
    return { success: false, error: `${overdrawn}.` };
  }

  // Insert into points ledger
  const { error } = await supabase
    .from('points_ledger')
    .insert({
      user_id: userId,
      delta_points: deltaPoints,
      reason: reason.trim(),
      created_by: profile.id,
      point_type: bucket,
    });
  
  if (error) {
    console.error('Error adjusting user points:', error);
    return { success: false, error: 'Failed to adjust points' };
  }

  // Null for a phone-only account, whose address is a placeholder nobody reads
  const notifyTo = deliverableEmail(targetUser.email);

  // Send notification email if requested
  // Whether it actually went decides what staff are told: a send skipped because email is
  // not set up used to read as "notified"
  let emailed = false;
  if (notifyUser && notifyTo) {
    try {
      const emailResult = await sendEmail({
        to: notifyTo,
        ...pointsAdjustmentNotificationEmail({
          recipientEmail: notifyTo,
          recipientName: targetUser.full_name ?? undefined,
          deltaPoints,
          reason: reason.trim(),
        }),
      });
      emailed = emailResult.success && !emailResult.skipped;
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
  
  const userLabel = notifyTo || targetUser.phone?.trim() || targetUser.full_name?.trim() || 'this user';
  const baseMessage = `Successfully ${deltaPoints > 0 ? 'added' : 'deducted'} ${Math.abs(deltaPoints)} points ${deltaPoints > 0 ? 'to' : 'from'} ${userLabel}`;
  const message = !notifyUser
    ? baseMessage
    : !notifyTo
      ? `${baseMessage}. They have no email address on file, so they were not emailed.`
      : emailed
        ? `${baseMessage} and notified user by email.`
        : `${baseMessage}, but the email to them could not be sent.`;
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

export interface BulkPreviewRow {
  row: number;
  email: string;
  /** Name, or the address, of the account the row matched */
  userLabel: string | null;
  delta: number | null;
  bucket: PointBucketType | null;
  /** The bucket as staff know it ("universal", or the store's own name for restricted) */
  bucketLabel: string | null;
  reason: string;
  error?: string;
}

export interface BulkPreviewResult {
  success: boolean;
  error?: string;
  rows?: BulkPreviewRow[];
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

function isDevModeConfig() {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
}

/**
 * Reads the file and checks every row against the database, the same way for the preview
 * and for applying it: the account each email belongs to, and that no deduction takes a
 * bucket below zero, counting the rows before it in the same file. Applying re-checks
 * rather than trusting the preview, since balances can move in between.
 */
async function checkBulkFile(
  supabase: Awaited<ReturnType<typeof requireAdmin>>['supabase'],
  formData: FormData
): Promise<{ error: string } | { rows: Array<BulkPreviewRow & { userId?: string }> }> {
  const file = formData.get('csv');
  if (!(file instanceof File)) {
    return { error: 'No file uploaded' };
  }
  if (!file.name.toLowerCase().endsWith('.csv')) {
    return { error: 'File must be a CSV' };
  }

  const parsed = parseBulkPointsCsv(await file.text(), [
    'restricted',
    BUCKET_LABEL.restricted.toLowerCase(),
  ]);
  if (parsed.length === 0) {
    return { error: 'No data rows found in the file' };
  }

  // Every account, matched by lower-cased address in code rather than with ilike, where the
  // "_" in an address like jane_doe@ would match any character
  const { data: profiles, error: profilesError } = await fetchAllRows<{
    id: string;
    email: string | null;
    full_name: string | null;
  }>((from, to) => supabase.from('profiles').select('id, email, full_name').order('id').range(from, to));

  if (profilesError) {
    console.error('Error reading users for a bulk upload:', profilesError);
    return { error: 'Could not look up the users in this file' };
  }

  const byEmail = new Map(
    profiles.filter((p) => p.email).map((p) => [p.email!.trim().toLowerCase(), p])
  );
  const matchedIds = [
    ...new Set(parsed.map((row) => byEmail.get(row.email)?.id).filter((id): id is string => !!id)),
  ];

  // Balances for the accounts in the file, a hundred at a time to keep each request short
  const balances = new Map<string, number>();
  for (let i = 0; i < matchedIds.length; i += 100) {
    const ids = matchedIds.slice(i, i + 100);
    const { data: ledger, error: ledgerError } = await fetchAllRows<{
      user_id: string;
      delta_points: number;
      point_type: string | null;
    }>((from, to) =>
      supabase
        .from('points_ledger')
        .select('user_id, delta_points, point_type')
        .in('user_id', ids)
        .order('id')
        .range(from, to)
    );

    if (ledgerError) {
      console.error('Error reading balances for a bulk upload:', ledgerError);
      return { error: 'Could not read the balances of the users in this file' };
    }

    for (const entry of ledger) {
      const key = `${entry.user_id}:${entry.point_type === 'restricted' ? 'restricted' : 'universal'}`;
      balances.set(key, (balances.get(key) ?? 0) + entry.delta_points);
    }
  }

  const rows = parsed.map((row) => {
    const user = byEmail.get(row.email);
    const checked: BulkPreviewRow & { userId?: string } = {
      row: row.row,
      email: row.email,
      userLabel: user ? user.full_name?.trim() || user.email : null,
      delta: row.delta,
      bucket: row.bucket,
      bucketLabel: row.bucket ? BUCKET_LABEL[row.bucket] : null,
      reason: row.reason,
      error: row.error,
      userId: user?.id,
    };

    if (checked.error || checked.delta === null || checked.bucket === null) return checked;

    if (!user) {
      // Phone-only accounts have no address to match
      checked.error = 'No user with this email';
      return checked;
    }

    const key = `${user.id}:${checked.bucket}`;
    const balance = balances.get(key) ?? 0;
    if (checked.delta < 0 && balance + checked.delta < 0) {
      const label = BUCKET_LABEL[checked.bucket];
      checked.error =
        balance > 0
          ? `Only ${balance} ${label} points to deduct from, so ${-checked.delta} can't be taken`
          : `No ${label} points to deduct from`;
      return checked;
    }

    balances.set(key, balance + checked.delta);
    return checked;
  });

  return { rows };
}

/** Shows what a bulk file would do, row by row, without applying any of it. */
export async function previewBulkPointsCsv(formData: FormData): Promise<BulkPreviewResult> {
  if (isDevModeConfig()) {
    return { success: false, error: 'Bulk points upload requires Supabase to be configured.' };
  }

  const { supabase } = await requireAdmin();

  try {
    const checked = await checkBulkFile(supabase, formData);
    if ('error' in checked) {
      return { success: false, error: checked.error };
    }
    return { success: true, rows: checked.rows.map(({ userId: _userId, ...row }) => row) };
  } catch (error) {
    console.error('Error previewing a bulk points file:', error);
    return { success: false, error: 'Failed to read the CSV file. Please check the format.' };
  }
}

/**
 * Applies the rows of a bulk file that check out, in one insert: either all of them land or
 * none do, so a slow upload can no longer stop halfway and be applied twice on a retry.
 * Rows with a problem are skipped and listed.
 */
export async function applyBulkPointsCsv(formData: FormData): Promise<BulkPointsResult> {
  if (isDevModeConfig()) {
    return { success: false, error: 'Bulk points upload requires Supabase to be configured.' };
  }

  const { supabase, profile } = await requireAdmin();

  try {
    const checked = await checkBulkFile(supabase, formData);
    if ('error' in checked) {
      return { success: false, error: checked.error };
    }

    const valid = checked.rows.filter((row) => !row.error && row.userId);
    const failures = checked.rows
      .filter((row) => row.error)
      .map((row) => ({ row: row.row, email: row.email, error: row.error! }));

    if (valid.length === 0) {
      return { success: false, error: 'No rows in this file can be applied.' };
    }

    const { error: insertError } = await supabase.from('points_ledger').insert(
      valid.map((row) => ({
        user_id: row.userId!,
        delta_points: row.delta!,
        reason: row.reason,
        created_by: profile.id,
        point_type: row.bucket!,
      }))
    );

    if (insertError) {
      console.error('Error inserting bulk points:', insertError);
      return { success: false, error: 'Nothing was applied: the points could not be saved.' };
    }

    revalidatePath('/admin/points');
    revalidatePath('/admin/users');
    revalidatePath('/dashboard');
    revalidatePath('/points-history');

    return {
      success: true,
      summary: {
        total: checked.rows.length,
        successful: valid.length,
        failed: failures.length,
        failures,
      },
    };
  } catch (error) {
    console.error('Error applying a bulk points file:', error);
    return { success: false, error: 'Failed to process the CSV file. Nothing was applied.' };
  }
}
