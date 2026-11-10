import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { google } from 'googleapis';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { decryptToken } from '@/lib/crypto';
import { SHARED_ORG_ID } from '@/lib/auth/domains';
import { revokeZohoToken } from '@/lib/email/providers/zoho';

/**
 * Disconnect the caller's sending inbox (Gmail or Zoho Mail): revoke the token with the
 * provider, delete it, and mark the inbox disconnected. Auth: Bearer <Firebase ID token>.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let uid: string;
  try {
    uid = (await adminAuth.verifyIdToken(authHeader.slice(7))).uid;
  } catch {
    return NextResponse.json({ error: 'Session expired — sign in again' }, { status: 401 });
  }

  const tokenRef = adminDb.collection('tokens').doc(uid);
  const data = (await tokenRef.get()).data();

  if (data?.encryptedRefreshToken) {
    try {
      const refreshToken = decryptToken(data.encryptedRefreshToken);
      if (data.provider === 'zoho' && data.accountsServer) {
        await revokeZohoToken({ accountsServer: data.accountsServer, refreshToken });
      } else {
        await new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET).revokeToken(refreshToken);
      }
    } catch (err) {
      // Revocation is best-effort; the token is deleted from Mustard either way.
      console.warn('Token revoke failed:', err instanceof Error ? err.message : err);
    }
  }

  await tokenRef.delete();
  await adminDb
    .collection('organizations')
    .doc(data?.orgId || SHARED_ORG_ID)
    .collection('users')
    .doc(uid)
    .set(
      {
        inboxStatus: 'disconnected',
        mailProvider: FieldValue.delete(),
        sendingEmail: FieldValue.delete(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

  return NextResponse.json({ success: true });
}
