/**
 * URL helpers for server routes. Environment values are parsed as real URLs, which also
 * repairs common typos such as "https:/example.com" (one slash) or a trailing slash.
 */

/** Parse an http(s) URL from an env var; null if it's missing or unusable. */
function parseUrl(raw?: string): URL | null {
  const value = (raw || '').trim().replace(/^["']|["']$/g, '');
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (!url.hostname || (!url.hostname.includes('.') && !isLocalHost(url.hostname))) return null;
    return url;
  } catch {
    return null;
  }
}

/**
 * Public base URL of the app (no trailing slash): the origin of the request being handled,
 * so people always come back to the same site they're signed in on. Falls back to
 * NEXT_PUBLIC_APP_URL when there's no request (e.g. background jobs).
 */
export function getAppUrl(request?: Request): string {
  const origin = request ? requestOrigin(request) : null;
  return origin || parseUrl(process.env.NEXT_PUBLIC_APP_URL)?.origin || 'http://localhost:3000';
}

/**
 * Gmail OAuth callback URL. Must exactly match an "Authorized redirect URI" on the Google
 * Cloud OAuth client. GOOGLE_REDIRECT_URI (normalised) is used when it's on the same domain
 * as the request; otherwise the callback on the request's own domain is used, so the
 * OAuth round-trip never lands people on a site where they aren't signed in.
 */
export function getGoogleRedirectUri(request?: Request): string {
  const appUrl = getAppUrl(request);
  const configured = parseUrl(process.env.GOOGLE_REDIRECT_URI);
  if (configured) {
    const normalised = `${configured.origin}${configured.pathname.replace(/\/+$/, '')}`;
    if (!request || configured.origin === appUrl) return normalised;
    console.warn(
      `[oauth] GOOGLE_REDIRECT_URI is on ${configured.origin} but this request came from ${appUrl}; ` +
        `using ${appUrl}/api/auth/google/callback. Add it to the OAuth client's authorized redirect URIs.`
    );
  }
  return `${appUrl}/api/auth/google/callback`;
}

/** True when the value is a well-formed absolute URL Google will accept as a redirect URI. */
export function isValidRedirectUri(uri: string): boolean {
  const url = parseUrl(uri);
  if (!url) return false;
  // Google requires https except for localhost during development.
  return url.protocol === 'https:' || isLocalHost(url.hostname);
}

function requestOrigin(request: Request): string | null {
  try {
    const host = request.headers.get('x-forwarded-host');
    if (host) {
      const proto = request.headers.get('x-forwarded-proto') || 'https';
      return new URL(`${proto.split(',')[0].trim()}://${host.split(',')[0].trim()}`).origin;
    }
    return new URL(request.url).origin;
  } catch {
    return null;
  }
}

function isLocalHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' || hostname === '[::1]';
}

