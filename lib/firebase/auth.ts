import {
  signInWithPopup,
  signOut as firebaseSignOut,
  User as FirebaseUser,
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

export async function signInWithGoogle(): Promise<FirebaseUser> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  await firebaseSignOut(auth);
}

async function findPendingInvite(email: string): Promise<(Invite & { orgId: string }) | null> {
  const normalized = email.toLowerCase().trim();
  // Invites live under each org — scan orgs by domain match first, then fallback query path
  // Production: invites are stored at organizations/{orgId}/invites and looked up via collection group
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
    // Index may not exist yet — invite claim also checked after org resolve
  }
  return null;
}

async function claimInviteInOrg(
  orgId: string,
  email: string
): Promise<Invite | null> {
  const normalized = email.toLowerCase().trim();
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
}

/**
 * Synchronize user profile & organization in Firestore.
 * First user on a domain becomes admin; pending invites override role/org.
 */
export async function syncUserProfile(
  fbUser: FirebaseUser
): Promise<{ user: User; organization: Organization }> {
  const email = fbUser.email || '';
  const domain = email.split('@')[1] || 'default.com';
  const defaultOrgId = `org_${domain.replace(/[^a-zA-Z0-9]/g, '_')}`;
  const userId = fbUser.uid;
  const now = new Date().toISOString();

  const pendingInvite = await findPendingInvite(email);
  const orgId = pendingInvite?.orgId || defaultOrgId;

  const orgRef = doc(db, 'organizations', orgId);
  const orgSnap = await getDoc(orgRef);

  let organization: Organization;
  const isNewOrg = !orgSnap.exists();

  if (!isNewOrg) {
    organization = orgSnap.data() as Organization;
  } else {
    organization = {
      id: orgId,
      name: `${domain.split('.')[0].charAt(0).toUpperCase()}${domain.split('.')[0].slice(1)} Workspace`,
      domain,
      createdAt: now,
      updatedAt: now,
      settings: {
        defaultDailyCapPerMailbox: 50,
        defaultSendingWindow: {
          startHour: 9,
          endHour: 17,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
        },
      },
    };
    await setDoc(orgRef, organization);
  }

  const invite =
    pendingInvite ||
    (await claimInviteInOrg(orgId, email));

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
    // Check for invitee placeholder by email
    const usersRef = collection(db, `organizations/${orgId}/users`);
    const emailQ = query(usersRef, where('email', '==', email.toLowerCase().trim()), limit(1));
    const emailSnap = await getDocs(emailQ);

    if (!emailSnap.empty) {
      const placeholder = emailSnap.docs[0].data() as User;
      // Migrate placeholder invite doc → real auth uid
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
        // Soft-delete placeholder by marking inactive (client can't always delete)
        await updateDoc(emailSnap.docs[0].ref, {
          status: 'inactive',
          updatedAt: now,
        });
      }
    } else {
      const role = invite?.role || (isNewOrg ? 'admin' : 'rep');
      user = {
        id: userId,
        orgId,
        email: email.toLowerCase().trim(),
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
    // Clean index
    await setDoc(doc(db, 'invites_index', invite.id), { status: 'accepted', updatedAt: now }, { merge: true }).catch(
      () => undefined
    );

    if (user.role !== invite.role) {
      await updateDoc(userRef, { role: invite.role, updatedAt: now });
      user = { ...user, role: invite.role };
    }
  }

  // Sync custom claims via server API (best-effort)
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
    // Claims sync is best-effort; role still lives on Firestore user doc
  }

  return { user, organization };
}

export async function updateOrganizationName(
  orgId: string,
  name: string
): Promise<void> {
  const orgRef = doc(db, 'organizations', orgId);
  await updateDoc(orgRef, {
    name: name.trim(),
    updatedAt: new Date().toISOString(),
  });
}
