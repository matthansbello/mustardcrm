import { NextResponse } from 'next/server';
import { adminDb, adminCredentialInfo, describeAdminCredentialError } from '@/lib/firebase/admin';
import { getAppUrl, getGoogleRedirectUri } from '@/lib/appUrl';

export const dynamic = 'force-dynamic';

/**
 * Server configuration check for administrators — reports which settings are present
 * (names only, never values) and whether Firestore is reachable with the Admin key.
 *
 *   https://<your-site>/api/health?key=<CRON_SECRET>
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = new URL(request.url).searchParams.get('key') || request.headers.get('x-cron-secret');
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const present = (name: string) => Boolean((process.env[name] || '').trim());
  const env = Object.fromEntries(
    [
      'FIREBASE_PROJECT_ID',
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
      'FIREBASE_SERVICE_ACCOUNT',
      'FIREBASE_CLIENT_EMAIL',
      'FIREBASE_PRIVATE_KEY',
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'GOOGLE_REDIRECT_URI',
      'NEXT_PUBLIC_APP_URL',
      'TOKEN_ENCRYPTION_KEY',
      'MUSTARD_ADMIN_EMAILS',
    ].map((name) => [name, present(name) ? 'set' : 'missing'])
  );

  let firestore = 'ok';
  try {
    await adminDb.collection('organizations').limit(1).get();
  } catch (err) {
    firestore = describeAdminCredentialError(err) || (err instanceof Error ? err.message : 'failed');
  }

  return NextResponse.json({
    ok: firestore === 'ok',
    firebaseAdmin: { credentialsFrom: adminCredentialInfo.source, missing: adminCredentialInfo.missing, firestore },
    gmailOAuth: { appUrl: getAppUrl(request), redirectUri: getGoogleRedirectUri(request) },
    env,
  });
}
