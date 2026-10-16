import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { adminDb } from '@/lib/firebase/admin';
import { encryptToken, verifyOAuthState } from '@/lib/crypto';

function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/google/callback`;

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured');
  }

  return {
    oauth2Client: new google.auth.OAuth2(clientId, clientSecret, redirectUri),
    redirectUri,
  };
}

/**
 * Google OAuth redirect callback (GET with ?code=).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const stateRaw = searchParams.get('state');
  const error = searchParams.get('error');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (error) {
    return NextResponse.redirect(`${appUrl}/settings?gmail=error&reason=${encodeURIComponent(error)}`);
  }

  if (!code || !stateRaw) {
    return NextResponse.redirect(`${appUrl}/settings?gmail=error&reason=missing_code`);
  }

  const state = verifyOAuthState(stateRaw);
  if (!state) {
    return NextResponse.redirect(`${appUrl}/settings?gmail=error&reason=invalid_state`);
  }
  const userId = state.userId || '';
  const orgId = state.orgId || '';

  if (!userId || !orgId) {
    return NextResponse.redirect(`${appUrl}/settings?gmail=error&reason=missing_state`);
  }

  try {
    const { oauth2Client } = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token && !tokens.access_token) {
      return NextResponse.redirect(`${appUrl}/settings?gmail=error&reason=no_tokens`);
    }

    const encryptedRefreshToken = tokens.refresh_token
      ? encryptToken(tokens.refresh_token)
      : undefined;
    const encryptedAccessToken = tokens.access_token
      ? encryptToken(tokens.access_token)
      : undefined;

    const existing = await adminDb.collection('tokens').doc(userId).get();
    const existingData = existing.data() || {};

    await adminDb
      .collection('tokens')
      .doc(userId)
      .set(
        {
          userId,
          orgId,
          encryptedRefreshToken:
            encryptedRefreshToken || existingData.encryptedRefreshToken || null,
          encryptedAccessToken: encryptedAccessToken || null,
          expiresAt: tokens.expiry_date || null,
          scope: tokens.scope || 'gmail.send gmail.readonly',
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

    await adminDb
      .collection('organizations')
      .doc(orgId)
      .collection('users')
      .doc(userId)
      .set(
        {
          inboxStatus: 'connected',
          lastConnectedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

    // Prefer returning users to onboarding step 3 if they came from there
    const returnTo = state.returnTo || '/onboarding?gmail=connected';
    const safeReturn = returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/settings?gmail=connected';
    return NextResponse.redirect(`${appUrl}${safeReturn}`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'token_exchange_failed';
    console.error('OAuth callback error:', message);
    return NextResponse.redirect(
      `${appUrl}/settings?gmail=error&reason=${encodeURIComponent(message)}`
    );
  }
}
