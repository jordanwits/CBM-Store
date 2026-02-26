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

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
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
        to: Array.isArray(params.to) ? params.to : [params.to],
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
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://cbmplasticsstore.com';
}
