import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { encryptToken, decryptToken, verifyOAuthState } from '@/lib/crypto';
import { getAppUrl, getZohoRedirectUri } from '@/lib/appUrl';
import {
  defaultAccountsServer,
  exchangeZohoCode,
  getZohoMailbox,
  mailApiBase,
  normalizeAccountsServer,
  revokeZohoToken,
} from '@/lib/email/providers/zoho';

/**
 * Zoho Mail OAuth callback (GET ?code=&state=&accounts-server=&location=).
 * Stores the encrypted refresh token, the user's Zoho data centre and send-from address,
 * and makes Zoho the user's sending mailbox.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const appUrl = getAppUrl(request);
  const fail = (reason: string) =>
    NextResponse.redirect(`${appUrl}/settings?mail=error&provider=zoho&reason=${encodeURIComponent(reason)}`);

  if (searchParams.get('error')) return fail(searchParams.get('error') || 'access_denied');

  const code = searchParams.get('code');
  const state = verifyOAuthState(searchParams.get('state') || '');
  if (!code) return fail('missing_code');
  if (!state || state.provider !== 'zoho' || !state.userId || !state.orgId) return fail('invalid_state');

  // Zoho says which data centre the user is in. Only accept real Zoho hosts — we send our client secret there.
  const rawServer = searchParams.get('accounts-server');
  const accountsServer = rawServer ? normalizeAccountsServer(rawServer) : defaultAccountsServer();
  if (!accountsServer) return fail('unknown_zoho_region');

  const { userId, orgId } = state;

  try {
    const tokens = await exchangeZohoCode({ accountsServer, code, redirectUri: getZohoRedirectUri(request) });
    if (!tokens.refreshToken) {
      // Zoho only returns a refresh token with access_type=offline + consent; without it we can't send on a schedule.
      return fail('no_refresh_token');
    }

    const apiBase = mailApiBase(accountsServer);
    const mailbox = await getZohoMailbox(apiBase, tokens.accessToken);
    const now = new Date().toISOString();

    const tokenRef = adminDb.collection('tokens').doc(userId);
    const previous = (await tokenRef.get()).data();
    if (previous?.provider === 'zoho' && previous.accountsServer && previous.encryptedRefreshToken) {
      // Replacing an older Zoho connection — revoke its refresh token.
      await revokeZohoToken({
        accountsServer: previous.accountsServer,
        refreshToken: decryptToken(previous.encryptedRefreshToken),
      }).catch(() => undefined);
    }

    // Full overwrite (no merge): one sending mailbox per user, so any Gmail token is replaced.
    await tokenRef.set({
      userId,
      orgId,
      provider: 'zoho',
      encryptedRefreshToken: encryptToken(tokens.refreshToken),
      encryptedAccessToken: encryptToken(tokens.accessToken),
      expiresAt: tokens.expiresAt,
      scope: tokens.scope,
      accountsServer,
      apiBase,
      zohoAccountId: mailbox.accountId,
      fromAddress: mailbox.fromAddress,
      fromName: mailbox.displayName || null,
      updatedAt: now,
    });

    await adminDb
      .collection('organizations')
      .doc(orgId)
      .collection('users')
      .doc(userId)
      .set(
        {
          inboxStatus: 'connected',
          mailProvider: 'zoho',
          sendingEmail: mailbox.fromAddress,
          lastConnectedAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

    const returnTo = state.returnTo || '/settings?mail=connected';
    const safeReturn = returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/settings?mail=connected';
    return NextResponse.redirect(`${appUrl}${safeReturn}${safeReturn.includes('?') ? '&' : '?'}provider=zoho`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'zoho_connect_failed';
    console.error('Zoho OAuth callback error:', message);
    return fail(message);
  }
}
