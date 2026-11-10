import { adminDb } from '@/lib/firebase/admin';
import { decryptToken, encryptToken } from '@/lib/crypto';
import type { MailboxToken, MailProvider } from '@/types';
import { refreshZohoAccessToken } from './providers/zoho';

/** Load a user's connected sending mailbox (tokens/{uid}); null when nothing is connected. */
export async function getMailbox(userId: string): Promise<{ provider: MailProvider; data: MailboxToken } | null> {
  const snap = await adminDb.collection('tokens').doc(userId).get();
  if (!snap.exists) return null;
  const data = snap.data() as MailboxToken;
  if (!data.encryptedRefreshToken) return null;
  return { provider: data.provider === 'zoho' ? 'zoho' : 'gmail', data };
}

/** A valid Zoho access token, reusing the cached one until shortly before it expires (they last 1 hour). */
export async function getZohoAccessToken(userId: string, data: MailboxToken): Promise<string> {
  if (data.encryptedAccessToken && data.expiresAt && data.expiresAt > Date.now() + 2 * 60 * 1000) {
    return decryptToken(data.encryptedAccessToken);
  }
  if (!data.accountsServer) throw new Error('Zoho mailbox is missing its accounts server — reconnect Zoho Mail.');
  const { accessToken, expiresAt } = await refreshZohoAccessToken({
    accountsServer: data.accountsServer,
    refreshToken: decryptToken(data.encryptedRefreshToken),
  });
  await adminDb
    .collection('tokens')
    .doc(userId)
    .set({ encryptedAccessToken: encryptToken(accessToken), expiresAt, updatedAt: new Date().toISOString() }, { merge: true });
  return accessToken;
}

/** Flag the user's inbox as needing reconnection (shown in the sidebar, Settings and Team). */
export async function markNeedsReauth(orgId: string, userId: string): Promise<void> {
  await adminDb
    .collection('organizations')
    .doc(orgId)
    .collection('users')
    .doc(userId)
    .set({ inboxStatus: 'needs_reauth', updatedAt: new Date().toISOString() }, { merge: true });
}
