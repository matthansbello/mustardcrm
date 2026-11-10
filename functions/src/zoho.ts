/**
 * Zoho Mail helpers for the scheduled sender. Mirrors lib/email/providers/zoho.ts in the
 * web app (Cloud Functions are a separate package and can't import it).
 */

export class ZohoApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = 'ZohoApiError';
  }
  get needsReauth(): boolean {
    return this.status === 401 || /invalid_code|invalid_token|INVALID_OAUTHTOKEN|invalid_client|access_denied/i.test(
      `${this.code} ${this.message}`
    );
  }
}

const ACCOUNTS_HOST = /^accounts\.(zoho\.(com|eu|in|com\.au|jp|sa|uk|com\.cn)|zohocloud\.ca)$/;

export async function refreshZohoAccessToken(accountsServer: string, refreshToken: string) {
  if (!ACCOUNTS_HOST.test(new URL(accountsServer).hostname)) throw new Error('Untrusted Zoho accounts server');
  const res = await fetch(`${accountsServer}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.ZOHO_CLIENT_ID || '',
      client_secret: process.env.ZOHO_CLIENT_SECRET || '',
      refresh_token: refreshToken,
    }).toString(),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || data.error || !data.access_token) {
    throw new ZohoApiError(`Zoho token refresh failed: ${data.error || res.status}`, res.ok ? 401 : res.status, data.error);
  }
  return { accessToken: data.access_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 };
}

async function zohoApi<T>(apiBase: string, accessToken: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  const json = (await res.json().catch(() => ({}))) as { status?: { code?: number; description?: string }; data?: unknown };
  const statusCode = json.status?.code ?? res.status;
  if (!res.ok || statusCode >= 400) {
    const data = (json.data || {}) as { errorCode?: string; moreInfo?: string };
    throw new ZohoApiError(
      `Zoho Mail API ${path} failed: ${json.status?.description || res.statusText}${data.moreInfo ? ` (${data.moreInfo})` : ''}`,
      statusCode,
      data.errorCode
    );
  }
  return json.data as T;
}

export async function sendZohoMail(p: {
  apiBase: string;
  accessToken: string;
  accountId: string;
  fromAddress: string;
  to: string;
  subject: string;
  html: string;
}): Promise<string> {
  const data = await zohoApi<{ messageId?: string | number }>(
    p.apiBase,
    p.accessToken,
    `/api/accounts/${encodeURIComponent(p.accountId)}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({
        fromAddress: p.fromAddress,
        toAddress: p.to,
        subject: p.subject,
        content: p.html,
        mailFormat: 'html',
        askReceipt: 'no',
      }),
    }
  );
  return String(data?.messageId ?? `zoho_${Date.now()}`);
}

function zohoDate(ms: number): string {
  const d = new Date(ms);
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()];
  return `${String(d.getUTCDate()).padStart(2, '0')}-${mon}-${d.getUTCFullYear()}`;
}

/** First message from `fromEmail` received after `sinceMs`, or null. */
export async function findZohoReplySince(p: {
  apiBase: string;
  accessToken: string;
  accountId: string;
  fromEmail: string;
  sinceMs: number;
}): Promise<{ messageId: string } | null> {
  const searchKey = `sender:${p.fromEmail}::fromDate:${zohoDate(p.sinceMs - 86400000)}`;
  const qs = new URLSearchParams({ searchKey, limit: '20', start: '1', receivedTime: String(Date.now() + 60000) });
  const messages = await zohoApi<
    { messageId?: string | number; fromAddress?: string; receivedtime?: string | number; receivedTime?: string | number }[]
  >(p.apiBase, p.accessToken, `/api/accounts/${encodeURIComponent(p.accountId)}/messages/search?${qs}`);
  const target = p.fromEmail.toLowerCase();
  for (const m of messages || []) {
    const received = Number(m.receivedtime ?? m.receivedTime ?? 0);
    if (received > p.sinceMs && String(m.fromAddress || '').toLowerCase().includes(target)) {
      return { messageId: String(m.messageId) };
    }
  }
  return null;
}
