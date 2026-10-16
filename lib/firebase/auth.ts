import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  User as FirebaseUser,
  UserCredential,
  AuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  updateProfile,
} from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db, googleProvider, oauthProviders, OAuthProviderId } from './client';
import { User, Organization } from '@/types';

const EMAIL_LINK_STORAGE_KEY = 'mustard_email_for_sign_in';

let pendingMailboxTokens: {
  accessToken: string | null;
  refreshToken: string | null;
  scope: string;
} | null = null;

let pendingDisplayName: string | null = null;

/** Google sign-in also grants Gmail send/read, so keep those tokens for the mailbox. */
function captureGoogleTokens(result: UserCredential) {
  if (result.providerId !== GoogleAuthProvider.PROVIDER_ID) return;
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const tokenResponse = (result as unknown as { _tokenResponse?: Record<string, string> })
    ._tokenResponse;

  pendingMailboxTokens = {
    accessToken: credential?.accessToken || tokenResponse?.oauthAccessToken || null,
    refreshToken: tokenResponse?.oauthRefreshToken || null,
    scope: tokenResponse?.oauthScope || '',
  };
}

/**
 * Popup sign-in for Google / Microsoft / Apple / GitHub.
 * Falls back to a full-page redirect when the browser blocks popups.
 */
export async function signInWithOAuth(providerId: OAuthProviderId): Promise<FirebaseUser | null> {
  const provider: AuthProvider = providerId === 'google' ? googleProvider : oauthProviders[providerId];
  try {
    const result = await signInWithPopup(auth, provider);
    captureGoogleTokens(result);
    return result.user;
  } catch (err: unknown) {
    if (authErrorCode(err) === 'auth/popup-blocked') {
      await signInWithRedirect(auth, provider);
      return null;
    }
    throw err;
  }
}

/** Call once on the auth pages to finish a redirect-based OAuth sign-in. */
export async function completeRedirectSignIn(): Promise<void> {
  const result = await getRedirectResult(auth);
  if (result) captureGoogleTokens(result);
}

export async function signInWithPassword(email: string, password: string): Promise<FirebaseUser> {
  const result = await signInWithEmailAndPassword(auth, email.trim(), password);
  return result.user;
}

export async function signUpWithPassword(
  email: string,
  password: string,
  displayName?: string
): Promise<FirebaseUser> {
  // The auth listener syncs the profile as soon as the account exists, before
  // updateProfile below lands — so hand the name to that sync directly.
  pendingDisplayName = displayName?.trim() || null;
  const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
  if (pendingDisplayName) {
    updateProfile(result.user, { displayName: pendingDisplayName }).catch(() => undefined);
  }
  sendEmailVerification(result.user).catch(() => undefined);
  return result.user;
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

/** Passwordless "magic link" sign-in. */
export async function sendMagicLink(email: string, next = '/dashboard'): Promise<void> {
  const url = `${window.location.origin}/login?next=${encodeURIComponent(next)}`;
  await sendSignInLinkToEmail(auth, email.trim(), { url, handleCodeInApp: true });
  try {
    window.localStorage.setItem(EMAIL_LINK_STORAGE_KEY, email.trim());
  } catch {
    // Storage unavailable — user will be asked for their email when they open the link
  }
}

export function isMagicLink(href: string): boolean {
  return isSignInWithEmailLink(auth, href);
}

export function storedMagicLinkEmail(): string | null {
  try {
    return window.localStorage.getItem(EMAIL_LINK_STORAGE_KEY);
  } catch {
    return null;
  }
}

export async function completeMagicLink(email: string, href: string): Promise<FirebaseUser> {
  const result = await signInWithEmailLink(auth, email.trim(), href);
  try {
    window.localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
  } catch {
    // ignore
  }
  return result.user;
}

export function authErrorCode(err: unknown): string {
  return typeof err === 'object' && err && 'code' in err ? String((err as { code: unknown }).code) : '';
}

/** Turn Firebase Auth error codes into something a person can act on. */
export function friendlyAuthError(err: unknown): string {
  switch (authErrorCode(err)) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Sign in instead.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/account-exists-with-different-credential':
      return 'This email is already registered with a different sign-in method. Use that method to sign in.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled yet. An admin needs to turn it on in the Firebase console (Authentication → Sign-in method).';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in was cancelled.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized for sign-in. Add it under Firebase Authentication → Settings → Authorized domains.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a moment and try again.';
    case 'auth/invalid-action-code':
    case 'auth/expired-action-code':
      return 'This sign-in link has expired or was already used. Request a new one.';
    default:
      return err instanceof Error ? err.message : 'Sign-in failed. Please try again.';
  }
}

/** Persist Gmail tokens after the org/user docs exist. */
export async function flushPendingMailboxTokens(
  idToken: string,
  orgId?: string
): Promise<boolean> {
  if (!pendingMailboxTokens?.accessToken && !pendingMailboxTokens?.refreshToken) {
    pendingMailboxTokens = null;
    return false;
  }

  try {
    const res = await fetch('/api/auth/google/session-tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ ...pendingMailboxTokens, orgId }),
    });
    const data = await res.json().catch(() => ({}));
    pendingMailboxTokens = null;
    return Boolean(res.ok && data.inboxConnected);
  } catch {
    pendingMailboxTokens = null;
    return false;
  }
}

/** Start the Gmail OAuth flow so any user (whatever they signed in with) can send from a Gmail inbox. */
export async function startGmailConnect(returnTo?: string): Promise<void> {
  const current = auth.currentUser;
  if (!current) throw new Error('Please sign in before connecting Gmail.');
  const idToken = await current.getIdToken();
  const qs = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : '';
  const res = await fetch(`/api/auth/google${qs}`, { headers: { Authorization: `Bearer ${idToken}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) {
    throw new Error(data.error || 'Failed to start Gmail OAuth');
  }
  window.location.href = data.url;
}

export async function signOutUser(): Promise<void> {
  await firebaseSignOut(auth);
}

/**
 * Create or refresh the user's profile in the shared workspace.
 * Role and membership are decided server-side (see /api/auth/sync).
 */
export async function syncUserProfile(
  fbUser: FirebaseUser
): Promise<{ user: User; organization: Organization }> {
  const idToken = await fbUser.getIdToken();
  const displayName = pendingDisplayName;
  pendingDisplayName = null;
  const res = await fetch('/api/auth/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ displayName }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Could not load your workspace profile.');
  }
  // Pick up the orgId/role custom claims the server may have just set.
  await fbUser.getIdToken(true).catch(() => undefined);
  return data as { user: User; organization: Organization };
}

export async function updateOrganizationName(orgId: string, name: string): Promise<void> {
  const orgRef = doc(db, 'organizations', orgId);
  await updateDoc(orgRef, {
    name: name.trim(),
    updatedAt: new Date().toISOString(),
  });
}
