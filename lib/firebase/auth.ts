import {
  signInWithPopup,
  signOut as firebaseSignOut,
  User as FirebaseUser,
  GoogleAuthProvider,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  limit,
} from 'firebase/firestore';
import { auth, db, googleProvider } from './client';
import { User, Organization, Invite } from '@/types';
import {
  defaultDailyCapForEmail,
  defaultOrgName,
  isConsumerGoogleEmail,
  resolveDefaultOrgId,
} from '@/lib/auth/domains';

let pendingMailboxTokens: {
  accessToken: string | null;
  refreshToken: string | null;
  scope: string;
} | null = null;

export async function signInWithGoogle(): Promise<FirebaseUser> {
  const result = await signInWithPopup(auth, googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const tokenResponse = (result as unknown as { _tokenResponse?: Record<string, string> })
    ._tokenResponse;

  pendingMailboxTokens = {
    accessToken: credential?.accessToken || tokenResponse?.oauthAccessToken || null,
    refreshToken: tokenResponse?.oauthRefreshToken || null,
    scope: tokenResponse?.oauthScope || '',
  };

  return result.user;
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

export async function signOutUser(): Promise<void> {
  await firebaseSignOut(auth);
}

async function findPendingInvite(email: string): Promise<(Invite & { orgId: string }) | null> {
  const normalized = email.toLowerCase().trim();
  try {
    const invitesGroup = collection(db, 'invites_index');
    const q = query(
      invitesGroup,
      where('email', '==', normalized),
      where('status', '==', 'pending'),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs[0].data() as Invite & { orgId: string };
    }
  } catch {
    // Index may not exist yet
  }
  return null;
}

async function claimInviteInOrg(orgId: string, email: string): Promise<Invite | null> {
  const normalized = email.toLowerCase().trim();
  try {
    const invitesRef = collection(db, `organizations/${orgId}/invites`);
    const q = query(
      invitesRef,
      where('email', '==', normalized),
      where('status', '==', 'pending'),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return snap.docs[0].data() as Invite;
  } catch {
    return null;
  }
}

/**
 * Synchronize user profile & organization in Firestore.
 * - Workspace domains: one org per domain; first user is admin.
 * - gmail.com / googlemail.com: personal org per user with full admin access.
 * - Pending invites always win over default org resolution.
 */
export async function syncUserProfile(
  fbUser: FirebaseUser
): Promise<{ user: User; organization: Organization }> {
  const email = (fbUser.email || '').toLowerCase().trim();
  const userId = fbUser.uid;
  const now = new Date().toISOString();
  const domain = email.split('@')[1] || 'gmail.com';
  const personal = isConsumerGoogleEmail(email);

  const pendingInvite = await findPendingInvite(email);
  const orgId = pendingInvite?.orgId || resolveDefaultOrgId(email, userId);

  const orgRef = doc(db, 'organizations', orgId);
  const orgSnap = await getDoc(orgRef);

  let organization: Organization;
  const isNewOrg = !orgSnap.exists();

  if (!isNewOrg) {
    organization = orgSnap.data() as Organization;
  } else {
    organization = {
      id: orgId,
      name: defaultOrgName(email, fbUser.displayName || undefined),
      domain,
      createdAt: now,
      updatedAt: now,
      settings: {
        defaultDailyCapPerMailbox: defaultDailyCapForEmail(email),
        defaultSendingWindow: {
          startHour: 9,
          endHour: 17,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
        },
      },
    };
    await setDoc(orgRef, organization);
  }

  const invite = pendingInvite || (await claimInviteInOrg(orgId, email));

  const userRef = doc(db, `organizations/${orgId}/users`, userId);
  const userSnap = await getDoc(userRef);

  let user: User;

  if (userSnap.exists()) {
    const existing = userSnap.data() as User;
    user = {
      ...existing,
      displayName: fbUser.displayName || existing.displayName,
      photoURL: fbUser.photoURL || existing.photoURL,
      status: existing.status === 'invited' ? 'active' : existing.status || 'active',
      updatedAt: now,
    };
    await updateDoc(userRef, {
      displayName: user.displayName,
      photoURL: user.photoURL || null,
      status: user.status,
      updatedAt: now,
    });
  } else {
    let emailSnap: any = { empty: true, docs: [] };
    try {
      const usersRef = collection(db, `organizations/${orgId}/users`);
      const emailQ = query(usersRef, where('email', '==', email), limit(1));
      emailSnap = await getDocs(emailQ);
    } catch {
      // Best-effort lookup for invited email placeholder
    }

    if (!emailSnap.empty && emailSnap.docs.length > 0) {
      const placeholder = emailSnap.docs[0].data() as User;
      user = {
        ...placeholder,
        id: userId,
        displayName: fbUser.displayName || placeholder.displayName,
        photoURL: fbUser.photoURL || undefined,
        status: 'active',
        updatedAt: now,
      };
      await setDoc(userRef, user);
      if (emailSnap.docs[0].id !== userId) {
        await updateDoc(emailSnap.docs[0].ref, {
          status: 'inactive',
          updatedAt: now,
        });
      }
    } else {
      const role = invite?.role || (isNewOrg || personal ? 'admin' : 'rep');
      user = {
        id: userId,
        orgId,
        email,
        displayName: fbUser.displayName || email.split('@')[0],
        photoURL: fbUser.photoURL || undefined,
        role,
        status: 'active',
        inboxStatus: 'disconnected',
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(userRef, user);
    }
  }

  if (invite) {
    const inviteRef = doc(db, `organizations/${orgId}/invites`, invite.id);
    await updateDoc(inviteRef, { status: 'accepted', updatedAt: now }).catch(() => undefined);
    await setDoc(doc(db, 'invites_index', invite.id), { status: 'accepted', updatedAt: now }, { merge: true }).catch(
      () => undefined
    );

    if (user.role !== invite.role) {
      await updateDoc(userRef, { role: invite.role, updatedAt: now });
      user = { ...user, role: invite.role };
    }
  }

  try {
    const idToken = await fbUser.getIdToken();
    await fetch('/api/auth/claims', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ orgId, role: user.role }),
    });
  } catch {
    // Claims sync is best-effort
  }

  return { user, organization };
}

export async function updateOrganizationName(orgId: string, name: string): Promise<void> {
  const orgRef = doc(db, 'organizations', orgId);
  await updateDoc(orgRef, {
    name: name.trim(),
    updatedAt: new Date().toISOString(),
  });
}
