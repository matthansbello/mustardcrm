/**
 * Zoho Mail REST API client (server-only).
 * Docs: https://www.zoho.com/mail/help/api/ — OAuth: https://www.zoho.com/mail/help/api/using-oauth-2.html
 *
 * Zoho runs separate data centres (US, EU, IN, AU, JP, CA, SA, UK, CN). The OAuth callback tells
 * us which one a user lives in (`accounts-server`); the Mail API lives on the matching
 * `mail.` host (accounts.zoho.eu → mail.zoho.eu).
 */

export const ZOHO_SCOPES = ['ZohoMail.messages.CREATE', 'ZohoMail.messages.READ', 'ZohoMail.accounts.READ'];

/** Only genuine Zoho accounts servers — we send the client secret there, so never trust arbitrary hosts. */
const ACCOUNTS_HOST = /^accounts\.(zoho\.(com|eu|in|com\.au|jp|sa|uk|com\.cn)|zohocloud\.ca)$/;

export class ZohoApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = 'ZohoApiError';
  }
  /** True when the user must reconnect (refresh token revoked/expired, scopes removed). */
  get needsReauth(): boolean {
    return this.status === 401 || /invalid_code|invalid_token|INVALID_OAUTHTOKEN|invalid_client|access_denied/i.test(
      `${this.code} ${this.message}`
    );
  }
}

export function zohoConfig() {
  const clientId = (process.env.ZOHO_CLIENT_ID || '').trim();
  const clientSecret = (process.env.ZOHO_CLIENT_SECRET || '').trim();
  return { clientId, clientSecret, configured: Boolean(clientId && clientSecret) };
}

/** Default accounts server (where the consent screen starts). Zoho's multi-DC setup redirects users to their own DC. */
export function defaultAccountsServer(): string {
  return normalizeAccountsServer(process.env.ZOHO_ACCOUNTS_URL) || 'https://accounts.zoho.com';
}

/** Validate an accounts-server URL; returns its origin or null if it isn't a Zoho accounts host. */
export function normalizeAccountsServer(raw?: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw.trim());
    return url.protocol === 'https:' && ACCOUNTS_HOST.test(url.hostname) ? url.origin : null;
  } catch {
    return null;
  }
}

/** Mail API base for a given accounts server, e.g. https://accounts.zoho.eu → https://mail.zoho.eu */
export function mailApiBase(accountsServer: string): string {
  const url = new URL(accountsServer);
  return `https://${url.hostname.replace(/^accounts\./, 'mail.')}`;
}

export function buildZohoAuthUrl(params: { redirectUri: string; state: string }): string {
  const { clientId } = zohoConfig();
  const url = new URL('/oauth/v2/auth', defaultAccountsServer());
  url.search = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: params.redirectUri,
    scope: ZOHO_SCOPES.join(','),
    access_type: 'offline', // we need a refresh token for scheduled sending
    prompt: 'consent', // Zoho only issues a refresh token on consent
    state: params.state,
  }).toString();
  return url.toString();
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  api_domain?: string;
  scope?: string;
  error?: string;
}

async function tokenRequest(accountsServer: string, body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${accountsServer}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
    cache: 'no-store',
  });
  const data = (await res.json().catch(() => ({}))) as TokenResponse;
  // Zoho reports OAuth errors with HTTP 200 and an `error` field.
  if (!res.ok || data.error || !data.access_token) {
    throw new ZohoApiError(`Zoho token request failed: ${data.error || res.status}`, res.ok ? 400 : res.status, data.error);
  }
  return data;
}

export async function exchangeZohoCode(params: { accountsServer: string; code: string; redirectUri: string }) {
  const { clientId, clientSecret } = zohoConfig();
  const data = await tokenRequest(params.accountsServer, {
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: params.redirectUri,
    code: params.code,
    scope: ZOHO_SCOPES.join(','),
  });
  return {
    accessToken: data.access_token!,
    refreshToken: data.refresh_token || null,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
    scope: data.scope || ZOHO_SCOPES.join(','),
  };
}

export async function refreshZohoAccessToken(params: { accountsServer: string; refreshToken: string }) {
  const { clientId, clientSecret } = zohoConfig();
  const data = await tokenRequest(params.accountsServer, {
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: params.refreshToken,
  });
  return { accessToken: data.access_token!, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 };
}

export async function revokeZohoToken(params: { accountsServer: string; refreshToken: string }): Promise<void> {
  await fetch(`${params.accountsServer}/oauth/v2/token/revoke?${new URLSearchParams({ token: params.refreshToken })}`, {
    method: 'POST',
    cache: 'no-store',
  }).catch(() => undefined);
}

async function zohoApi<T>(apiBase: string, accessToken: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`, // Zoho Mail requires this prefix, not "Bearer"
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => ({}))) as {
    status?: { code?: number; description?: string };
    data?: unknown;
  };
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

export interface ZohoMailbox {
  accountId: string;
  /** Verified "send from" address used for sequences. */
  fromAddress: string;
  displayName: string;
}

/** The user's primary Zoho mailbox and its verified send-from address. */
export async function getZohoMailbox(apiBase: string, accessToken: string): Promise<ZohoMailbox> {
  type Account = {
    accountId: string;
    type?: string;
    primaryEmailAddress?: string;
    mailboxAddress?: string;
    displayName?: string;
    accountDisplayName?: string;
    sendMailDetails?: { fromAddress?: string; displayName?: string; status?: boolean }[];
  };
  const accounts = await zohoApi<Account[]>(apiBase, accessToken, '/api/accounts');
  const account =
    accounts.find((a) => a.type === 'ZOHO_ACCOUNT' && (a.primaryEmailAddress || a.mailboxAddress)) ||
    accounts.find((a) => a.primaryEmailAddress || a.mailboxAddress);
  if (!account) throw new ZohoApiError('No Zoho Mail mailbox found on this account.', 404, 'NO_MAILBOX');

  const primary = (account.primaryEmailAddress || account.mailboxAddress || '').toLowerCase();
  const sendable = (account.sendMailDetails || []).filter((d) => d.fromAddress && d.status !== false);
  const from = sendable.find((d) => d.fromAddress!.toLowerCase() === primary) || sendable[0];

  return {
    accountId: String(account.accountId),
    fromAddress: (from?.fromAddress || primary).toLowerCase(),
    displayName: from?.displayName || account.displayName || account.accountDisplayName || '',
  };
}

export async function sendZohoMail(params: {
  apiBase: string;
  accessToken: string;
  accountId: string;
  fromAddress: string;
  to: string;
  subject: string;
  html: string;
}): Promise<{ messageId: string }> {
  // Plain address: Zoho applies the display name configured for this send-from address.
  const data = await zohoApi<{ messageId?: string | number; mailId?: string }>(
    params.apiBase,
    params.accessToken,
    `/api/accounts/${encodeURIComponent(params.accountId)}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({
        fromAddress: params.fromAddress,
        toAddress: params.to,
        subject: params.subject,
        content: params.html,
        mailFormat: 'html',
        askReceipt: 'no',
      }),
    }
  );
  return { messageId: String(data?.messageId ?? data?.mailId ?? `zoho_${Date.now()}`) };
}

function zohoDate(ms: number): string {
  const d = new Date(ms);
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()];
  return `${String(d.getUTCDate()).padStart(2, '0')}-${mon}-${d.getUTCFullYear()}`;
}

/**
 * Has `fromEmail` sent the mailbox anything since `sinceMs`? Used for reply detection,
 * since Zoho has no push notifications like Gmail's Pub/Sub watch.
 */
export async function findZohoReplySince(params: {
  apiBase: string;
  accessToken: string;
  accountId: string;
  fromEmail: string;
  sinceMs: number;
}): Promise<{ messageId: string; subject: string; receivedAt: number } | null> {
  // fromDate is day-granular (and in the mailbox's timezone), so start a day early and filter precisely below.
  const searchKey = `sender:${params.fromEmail}::fromDate:${zohoDate(params.sinceMs - 86400000)}`;
  const qs = new URLSearchParams({ searchKey, limit: '20', start: '1', receivedTime: String(Date.now() + 60000) });
  const messages = await zohoApi<
    { messageId?: string | number; fromAddress?: string; subject?: string; receivedtime?: string | number; receivedTime?: string | number }[]
  >(params.apiBase, params.accessToken, `/api/accounts/${encodeURIComponent(params.accountId)}/messages/search?${qs}`);

  const target = params.fromEmail.toLowerCase();
  for (const m of messages || []) {
    const received = Number(m.receivedtime ?? m.receivedTime ?? 0);
    const from = String(m.fromAddress || '').toLowerCase();
    if (received > params.sinceMs && from.includes(target)) {
      return { messageId: String(m.messageId), subject: m.subject || '', receivedAt: received };
    }
  }
  return null;
}
