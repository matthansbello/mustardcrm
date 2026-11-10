import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import { signOAuthState } from '@/lib/crypto';
import { SHARED_ORG_ID } from '@/lib/auth/domains';
import { getZohoRedirectUri, isValidRedirectUri } from '@/lib/appUrl';
import { buildZohoAuthUrl, zohoConfig } from '@/lib/email/providers/zoho';

/**
 * Start the Zoho Mail OAuth flow. Returns { url } for the client to redirect to.
 * Auth: Bearer <Firebase ID token>.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Sign in before connecting Zoho Mail' }, { status: 401 });
  }

  let userId: string;
  try {
    userId = (await adminAuth.verifyIdToken(authHeader.slice(7))).uid;
  } catch {
    return NextResponse.json({ error: 'Session expired — sign in again' }, { status: 401 });
  }

  if (!zohoConfig().configured) {
    return NextResponse.json(
      { error: 'Zoho Mail isn’t set up on this server yet (ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET missing).' },
      { status: 500 }
    );
  }

  const redirectUri = getZohoRedirectUri(request);
  if (!isValidRedirectUri(redirectUri)) {
    console.error(`[oauth] Invalid Zoho redirect URI: ${redirectUri}`);
    return NextResponse.json(
      { error: `Zoho Mail connection is misconfigured (invalid redirect address: ${redirectUri}).` },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const returnTo = searchParams.get('returnTo') || '/settings?mail=connected';
  const state = signOAuthState({ userId, orgId: SHARED_ORG_ID, returnTo, provider: 'zoho' });

  return NextResponse.json({ url: buildZohoAuthUrl({ redirectUri, state }) });
}
