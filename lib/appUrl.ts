/**
 * Public base URL of the app. Uses NEXT_PUBLIC_APP_URL, but if that still
 * points at localhost while we're serving a real domain (a common deploy
 * misconfiguration), falls back to the incoming request's origin so OAuth
 * redirects and links don't send people to localhost.
 */
export function getAppUrl(request?: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '');
  const origin = request ? requestOrigin(request) : null;
  if (configured && !(origin && isLocal(configured) && !isLocal(origin))) return configured;
  return origin || configured || 'http://localhost:3000';
}

/** Gmail OAuth callback URL — must also be listed in the Google Cloud OAuth client. */
export function getGoogleRedirectUri(request?: Request): string {
  const configured = process.env.GOOGLE_REDIRECT_URI;
  const appUrl = getAppUrl(request);
  if (configured && !(isLocal(configured) && !isLocal(appUrl))) return configured;
  return `${appUrl}/api/auth/google/callback`;
}

function requestOrigin(request: Request): string {
  const host = request.headers.get('x-forwarded-host');
  if (host) {
    const proto = request.headers.get('x-forwarded-proto') || 'https';
    return `${proto.split(',')[0].trim()}://${host.split(',')[0].trim()}`;
  }
  return new URL(request.url).origin;
}

function isLocal(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
  } catch {
    return false;
  }
}
