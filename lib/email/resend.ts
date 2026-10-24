import { isReservedPhoneLoginEmail } from '@/lib/auth/phone';

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

interface SendEmailResult {
  success: boolean;
  error?: string;
  skipped?: boolean;
}

/**
 * The address to email, or null when there is nowhere real to send.
 *
 * Accounts made with "Phone + temp password" carry a placeholder address on the reserved
 * phone-login.invalid domain (lib/auth/phone.ts) so Supabase's email auth works underneath.
 * It is never a mailbox: anything sent there fails or bounces. Callers that tell staff an
 * email went out check this first, so a phone-only customer reads as "no email on file".
 */
export function deliverableEmail(email: string | null | undefined): string | null {
  const trimmed = email?.trim();
  if (!trimmed || isReservedPhoneLoginEmail(trimmed)) {
    return null;
  }
  return trimmed;
}

/**
 * Whether emails can go out at all. Without both settings sendEmail skips every send
 * quietly, so anything that tells staff "the customer has been emailed" before the send has
 * happened (it runs after the response) checks this first.
 */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.FROM_EMAIL);
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  // Backstop for any caller that did not check: never hand Resend a placeholder address.
  // A list (the admin inboxes) keeps its real addresses; with none left, nothing is sent.
  const requested = Array.isArray(params.to) ? params.to : [params.to];
  const recipients = requested
    .map(deliverableEmail)
    .filter((email): email is string => email !== null);

  if (recipients.length === 0) {
    console.log('[Email] Skipped sending:', {
      to: params.to,
      subject: params.subject,
      reason: 'no deliverable recipient (blank or phone-login placeholder)',
    });
    return { success: true, skipped: true };
  }

  // Check for required env vars
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.FROM_EMAIL;
  
  // Dev mode or missing config - skip sending
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  
  if (isDevMode || !apiKey || !fromEmail) {
    const reason = isDevMode
      ? 'dev mode (NEXT_PUBLIC_SUPABASE_URL missing or placeholder)'
      : !apiKey
        ? 'RESEND_API_KEY not set'
        : 'FROM_EMAIL not set';
    console.log('[Email] Skipped sending:', {
      to: params.to,
      subject: params.subject,
      reason,
    });
    return { success: true, skipped: true };
  }
  
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: recipients,
        subject: params.subject,
        html: params.html,
        text: params.text || stripHtml(params.html),
      }),
    });
    
    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[Email] Failed to send:', { status: response.status, body: errorBody });
      let errorMessage = `Failed to send email: ${response.status}`;
      try {
        const parsed = JSON.parse(errorBody);
        if (parsed?.message) errorMessage = parsed.message;
      } catch {
        if (errorBody) errorMessage = errorBody.slice(0, 200);
      }
      return { success: false, error: errorMessage };
    }
    
    const data = await response.json();
    console.log('[Email] Sent successfully:', {
      to: params.to,
      subject: params.subject,
      id: data.id,
    });
    
    return { success: true };
  } catch (error) {
    console.error('[Email] Error sending email:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Simple HTML stripper for text fallback
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

export function getAdminEmails(): string[] {
  const emails = process.env.ADMIN_NOTIFICATION_EMAILS;
  if (!emails) return [];
  return emails.split(',').map(e => e.trim()).filter(e => e.length > 0);
}

export function getSiteUrl(): string {
  const fallback = 'https://www.cbmshop.com';

  const parse = (raw: string): URL | null => {
    const trimmed = raw.trim();
    if (!trimmed.length) return null;
    try {
      // Allow passing "example.com" (no protocol) in env vars.
      return new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    } catch {
      return null;
    }
  };

  const normalize = (url: URL): string =>
    // Remove trailing slash for consistent URL joining.
    `${url.protocol}//${url.host}${url.pathname}`.replace(/\/+$/, '');

  // A localhost value copied from a local .env sends customers to their own
  // machine, so it can never be trusted once we're running in production.
  const isLocalHost = (url: URL): boolean =>
    url.hostname === 'localhost' || url.hostname === '127.0.0.1';

  // Vercel's own hostnames sit behind deployment protection, so a customer
  // following a link to one lands on a Vercel login screen instead of the store.
  const isVercelHost = (url: URL): boolean =>
    url.hostname === 'vercel.app' || url.hostname.endsWith('.vercel.app');

  const isProd = process.env.NODE_ENV === 'production';

  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    // Vercel's stable production alias — only usable once a custom domain is
    // attached to the project, which the isVercelHost check enforces.
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const url = parse(candidate);
    if (!url) continue;
    if (isVercelHost(url)) continue;
    if (isProd && isLocalHost(url)) continue;
    return normalize(url);
  }

  return fallback;
}
