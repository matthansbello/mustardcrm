import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { encryptToken } from '@/lib/crypto';
import { SHARED_ORG_ID } from '@/lib/auth/domains';

/**
 * Persist Gmail OAuth tokens captured from Firebase Google sign-in.
 * Personal gmail.com accounts get sending access without a second OAuth
 * when Google returns a refresh token (prompt=consent + access_type=offline).
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
    const body = await request.json();
    const accessToken = typeof body.accessToken === 'string' ? body.accessToken : null;
    const refreshToken = typeof body.refreshToken === 'string' ? body.refreshToken : null;
    const scope = typeof body.scope === 'string' ? body.scope : '';

    if (!accessToken && !refreshToken) {
      return NextResponse.json({ error: 'Missing tokens' }, { status: 400 });
    }

    const orgId = SHARED_ORG_ID;

    const existing = await adminDb.collection('tokens').doc(decoded.uid).get();
    const existingData = existing.data() || {};

    const hasSendScope =
      scope.includes('gmail.send') ||
      String(existingData.scope || '').includes('gmail.send');

    await adminDb
      .collection('tokens')
      .doc(decoded.uid)
      .set(
        {
          userId: decoded.uid,
          orgId,
          encryptedRefreshToken: refreshToken
            ? encryptToken(refreshToken)
            : existingData.encryptedRefreshToken || null,
          encryptedAccessToken: accessToken ? encryptToken(accessToken) : existingData.encryptedAccessToken || null,
          scope: scope || existingData.scope || 'gmail.send gmail.readonly',
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

    const canSend = Boolean(refreshToken || existingData.encryptedRefreshToken) && hasSendScope;

    if (canSend) {
      await adminDb
        .collection('organizations')
        .doc(orgId)
        .collection('users')
        .doc(decoded.uid)
        .set(
          {
            inboxStatus: 'connected',
            lastConnectedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
    }

    return NextResponse.json({
      success: true,
      inboxConnected: canSend,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to store tokens';
    console.error('session-tokens error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
