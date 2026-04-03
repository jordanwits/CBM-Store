'use server';

import { createClient } from '@/lib/supabase/server';
import { displayProfileName } from '@/lib/auth/display-contact';
import { getAdminRecipientEmails } from '@/lib/email/admin-recipients';
import { sendEmail, getSiteUrl } from '@/lib/email/resend';

export interface SubmitProductSuggestionResult {
  success: boolean;
  error?: string;
}

function isDevMode() {
  return (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')
  );
}

const MAX_LEN = 500;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function submitProductSuggestion(suggestion: string): Promise<SubmitProductSuggestionResult> {
  const trimmed = suggestion?.trim() ?? '';
  if (!trimmed) {
    return { success: false, error: 'Please enter a suggestion.' };
  }
  if (trimmed.length > MAX_LEN) {
    return { success: false, error: `Suggestion must be ${MAX_LEN} characters or less.` };
  }

  if (isDevMode()) {
    return { success: true };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: 'You must be signed in to suggest a product.' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, phone')
    .eq('id', user.id)
    .single();

  const submitterLabel = displayProfileName(profile?.full_name, profile?.email, profile?.phone);

  const { error: insertError } = await supabase.from('product_suggestions').insert({
    user_id: user.id,
    suggestion: trimmed,
  });

  if (insertError) {
    console.error('[Product suggestion] insert error:', insertError);
    return { success: false, error: insertError.message || 'Could not save your suggestion.' };
  }

  try {
    const adminEmails = await getAdminRecipientEmails();
    if (adminEmails.length === 0) {
      console.warn('[Product suggestion] No admin recipient emails; suggestion saved only in database.');
      return { success: true };
    }

    const submittedAt = new Date().toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    const siteUrl = getSiteUrl();
    const subject = `New product suggestion — ${submitterLabel}`;
    const safeSuggestion = escapeHtml(trimmed);
    const safeName = escapeHtml(submitterLabel);

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #eff6ff; border-radius: 8px; padding: 24px; margin-bottom: 20px;">
    <h1 style="color: #1e3a5f; margin: 0 0 8px 0; font-size: 20px;">New product suggestion</h1>
    <p style="margin: 0; font-size: 14px; color: #4b5563;">Someone suggested an item for the store.</p>
  </div>
  <div style="background-color: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <h2 style="font-size: 16px; margin: 0 0 12px 0;">Suggestion</h2>
    <p style="margin: 0; white-space: pre-wrap; color: #111827;">${safeSuggestion}</p>
    <table style="width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px;">
      <tr>
        <td style="padding: 6px 0; border-top: 1px solid #f3f4f6;"><strong>From</strong></td>
        <td style="padding: 6px 0; border-top: 1px solid #f3f4f6; text-align: right;">${safeName}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0;"><strong>Submitted</strong></td>
        <td style="padding: 6px 0; text-align: right;">${escapeHtml(submittedAt)}</td>
      </tr>
    </table>
  </div>
  <div style="text-align: center;">
    <a href="${siteUrl}/admin" style="display: inline-block; background-color: #2563eb; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; font-size: 14px;">Open admin</a>
  </div>
</body>
</html>
`;

    const emailResult = await sendEmail({
      to: adminEmails,
      subject,
      html,
    });

    if (!emailResult.success && !emailResult.skipped) {
      console.error('[Product suggestion] Email failed:', emailResult.error);
    }
  } catch (e) {
    console.error('[Product suggestion] Notification error:', e);
  }

  return { success: true };
}
