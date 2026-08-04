import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  writeBatch,
  limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { User, UserRole, Invite } from '@/types';

export async function getTeammates(orgId: string): Promise<User[]> {
  try {
    const usersRef = collection(db, `organizations/${orgId}/users`);
    const snapshot = await getDocs(usersRef);
    const users: User[] = [];
    snapshot.forEach((docSnap) => {
      const u = docSnap.data() as User;
      if (u.status !== 'inactive') {
        users.push(u);
      }
    });
    return users;
  } catch (error) {
    console.error('Error fetching teammates:', error);
    return [];
  }
}

/**
 * Invite a teammate by email. Creates invite + placeholder user doc.
 * When they sign in with Google, syncUserProfile claims the invite.
 */
export async function inviteTeammate(
  orgId: string,
  email: string,
  role: UserRole,
  invitedBy: string
): Promise<{ user: User; invite: Invite }> {
  const normalizedEmail = email.toLowerCase().trim();
  const now = new Date().toISOString();
  const inviteId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const placeholderId = `pending_${btoa(normalizedEmail).replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)}`;

  // Prevent duplicate active invites
  const existingQ = query(
    collection(db, `organizations/${orgId}/invites`),
    where('email', '==', normalizedEmail),
    where('status', '==', 'pending'),
    limit(1)
  );
  const existing = await getDocs(existingQ);
  if (!existing.empty) {
    throw new Error('An invite is already pending for this email');
  }

  const invite: Invite = {
    id: inviteId,
    orgId,
    email: normalizedEmail,
    role,
    invitedBy,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(doc(db, `organizations/${orgId}/invites`, inviteId), invite);
  await setDoc(doc(db, 'invites_index', inviteId), {
    ...invite,
    orgId,
  });

  const newUser: User = {
    id: placeholderId,
    orgId,
    email: normalizedEmail,
    displayName: normalizedEmail.split('@')[0],
    role,
    status: 'invited',
    inboxStatus: 'disconnected',
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(doc(db, `organizations/${orgId}/users`, placeholderId), newUser);

  return { user: newUser, invite };
}

export async function bulkInviteTeammates(
  orgId: string,
  rows: { email: string; role: UserRole; displayName?: string }[],
  invitedBy: string
): Promise<{ invited: number; skipped: number; errors: string[] }> {
  let invited = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      await inviteTeammate(orgId, row.email, row.role, invitedBy);
      invited++;
    } catch (err: unknown) {
      skipped++;
      errors.push(
        `${row.email}: ${err instanceof Error ? err.message : 'failed'}`
      );
    }
  }

  return { invited, skipped, errors };
}

export async function deactivateTeammate(
  orgId: string,
  userId: string,
  reassignedOwnerId: string
): Promise<void> {
  const now = new Date().toISOString();

  const userRef = doc(db, `organizations/${orgId}/users`, userId);
  await updateDoc(userRef, {
    status: 'inactive',
    inboxStatus: 'disconnected',
    updatedAt: now,
  });

  const contactsRef = collection(db, `organizations/${orgId}/contacts`);
  const contactsQuery = query(contactsRef, where('ownerId', '==', userId));
  const contactsSnap = await getDocs(contactsQuery);

  const dealsRef = collection(db, `organizations/${orgId}/deals`);
  const dealsQuery = query(dealsRef, where('ownerId', '==', userId));
  const dealsSnap = await getDocs(dealsQuery);

  // Firestore batches max 500 ops
  const allUpdates = [
    ...contactsSnap.docs.map((d) => ({
      ref: d.ref,
      data: { ownerId: reassignedOwnerId, updatedAt: now },
    })),
    ...dealsSnap.docs.map((d) => ({
      ref: d.ref,
      data: { ownerId: reassignedOwnerId, updatedAt: now },
    })),
  ];

  for (let i = 0; i < allUpdates.length; i += 400) {
    const batch = writeBatch(db);
    allUpdates.slice(i, i + 400).forEach(({ ref, data }) => {
      batch.update(ref, data);
    });
    await batch.commit();
  }
}
