import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { adminAuth } from '@/lib/firebase/admin';
import { signOAuthState } from '@/lib/crypto';
import { SHARED_ORG_ID } from '@/lib/auth/domains';
import { getGoogleRedirectUri } from '@/lib/appUrl';

/**
 * Start Gmail OAuth consent flow.
 * Returns { url } for the client to redirect to.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Sign in before connecting Gmail' }, { status: 401 });
  }

  let userId: string;
  try {
    userId = (await adminAuth.verifyIdToken(authHeader.slice(7))).uid;
  } catch {
    return NextResponse.json({ error: 'Session expired — sign in again' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const returnTo = searchParams.get('returnTo') || '/onboarding?gmail=connected';

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = getGoogleRedirectUri(request);

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'Google OAuth credentials not configured on server' },
      { status: 500 }
    );
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  const scopes = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
  ];

  const state = signOAuthState({ userId, orgId: SHARED_ORG_ID, returnTo });

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
    state,
    include_granted_scopes: true,
    // Do not pass `hd` — personal gmail.com accounts must be able to authorize send.
  });

  return NextResponse.json({ url: authUrl });
}
