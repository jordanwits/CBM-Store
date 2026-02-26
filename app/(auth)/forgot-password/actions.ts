'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail, getSiteUrl } from '@/lib/email/resend';

const APP_NAME = 'CBM Plastics Rewards';

export interface ForgotPasswordResult {
  success: boolean;
  error?: string;
}

function isDevMode() {
  return (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')
  );
}

/**
 * Sends a password reset email via Resend.
 * Security: Always returns success to avoid revealing whether an email exists.
 */
export async function submitForgotPassword(formData: FormData): Promise<ForgotPasswordResult> {
  const email = formData.get('email')?.toString()?.trim();
  if (!email) {
    return { success: false, error: 'Email is required' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { success: false, error: 'Invalid email address' };
  }

  if (isDevMode()) {
    return { success: false, error: 'Password reset is not available in development mode.' };
  }

  try {
    const supabase = createAdminClient();
    const siteUrl = getSiteUrl();
    const redirectTo = `${siteUrl}/update-password`;

    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo,
      },
    });

    if (linkError || !linkData?.properties?.action_link) {
      // Security: Do not reveal whether the email exists. Always return success.
      console.error('[Forgot Password] Link generation failed:', linkError?.message);
      return { success: true };
    }

    let resetLink = linkData.properties.action_link;
    // Replace localhost in redirect_to param with our site URL
    try {
      const url = new URL(resetLink);
      const redirectTo = url.searchParams.get('redirect_to');
      if (redirectTo && (redirectTo.includes('localhost') || redirectTo.includes('127.0.0.1'))) {
        url.searchParams.set('redirect_to', `${siteUrl}/update-password`);
        resetLink = url.toString();
      }
    } catch {
      // If URL parsing fails, use link as-is
    }

    const emailResult = await sendPasswordResetEmail({
      email,
      resetLink,
    });

    if (!emailResult.success && !emailResult.skipped) {
      console.error('[Forgot Password] Email send failed:', emailResult.error);
      // Still return success - don't reveal email delivery failure to user
    }

    return { success: true };
  } catch (err) {
    console.error('[Forgot Password] Unexpected error:', err);
    // Security: Return success to avoid leaking implementation details
    return { success: true };
  }
}

async function sendPasswordResetEmail(params: { email: string; resetLink: string }) {
  const siteUrl = getSiteUrl();
  const subject = `Reset Your Password - ${APP_NAME}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #fef3c7; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
    <h1 style="color: #92400e; margin: 0 0 10px 0;">Reset Your Password</h1>
    <p style="font-size: 16px; margin: 0; color: #78350f;">You requested a password reset for your ${APP_NAME} account.</p>
  </div>
  
  <div style="background-color: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <p style="margin: 0 0 15px 0;">Hi,</p>
    <p style="margin: 0 0 15px 0;">
      Click the button below to reset your password for ${APP_NAME}. If you didn't request this, you can safely ignore this email.
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${params.resetLink}" style="display: inline-block; background-color: #2563eb; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">Reset Password</a>
    </div>
    
    <p style="margin: 15px 0 0 0; font-size: 14px; color: #666;">
      Or copy and paste this link into your browser:
    </p>
    <p style="margin: 5px 0 0 0; font-size: 12px; color: #2563eb; word-break: break-all;">
      ${params.resetLink}
    </p>
  </div>
  
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin-top: 20px;">
    <p style="margin: 0; font-size: 14px; color: #666;">
      <strong>Note:</strong> This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
    </p>
  </div>
  
  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
    <p style="margin: 0; font-size: 12px; color: #999;">
      ${APP_NAME}<br>
      <a href="${siteUrl}" style="color: #2563eb; text-decoration: none;">${siteUrl}</a>
    </p>
  </div>
</body>
</html>
  `;

  const text = `
Reset Your Password - ${APP_NAME}

Hi,

You requested a password reset for your ${APP_NAME} account. Click the link below to set a new password:

${params.resetLink}

This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.

${APP_NAME}
${siteUrl}
  `.trim();

  return await sendEmail({
    to: params.email,
    subject,
    html,
    text,
  });
}
