import { NextResponse } from 'next/server';
import { adminAuth, adminDb, describeAdminCredentialError } from '@/lib/firebase/admin';
import {
  SHARED_ORG_ID,
  SHARED_ORG_NAME,
  defaultDailyCapForEmail,
  normalizeEmailDomain,
} from '@/lib/auth/domains';
import type { Invite, Organization, User, UserRole } from '@/types';

const ADMIN_EMAILS = new Set(
  (process.env.MUSTARD_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);

/**
 * Create or refresh the signed-in user's profile in the shared workspace.
 * Runs server-side so roles can't be chosen by the client.
 * - First user ever (or anyone in MUSTARD_ADMIN_EMAILS) becomes admin.
 * - Pending invites / placeholder docs decide the role for invited users.
 * - Everyone else joins as a rep.
 * Auth: Bearer <Firebase ID token>. Works for every Firebase sign-in provider.
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
    const uid = decoded.uid;
    const email = (decoded.email || '').toLowerCase().trim();
    const body = await request.json().catch(() => ({}));
    const requestedName =
      typeof body.displayName === 'string' ? body.displayName.trim().slice(0, 80) : '';
    const tokenName = typeof decoded.name === 'string' ? decoded.name : '';
    const displayName = tokenName || requestedName || email.split('@')[0] || 'New user';
    const photoURL = typeof decoded.picture === 'string' ? decoded.picture : null;
    const now = new Date().toISOString();
    const orgId = SHARED_ORG_ID;

    const orgRef = adminDb.collection('organizations').doc(orgId);
    const userRef = orgRef.collection('users').doc(uid);

    const result = await adminDb.runTransaction(async (tx) => {
      const [orgSnap, userSnap] = await Promise.all([tx.get(orgRef), tx.get(userRef)]);

      const inviteSnap = email
        ? await tx.get(
            orgRef
              .collection('invites')
              .where('email', '==', email)
              .where('status', '==', 'pending')
              .limit(1)
          )
        : null;
      const placeholderSnap =
        email && !userSnap.exists
          ? await tx.get(orgRef.collection('users').where('email', '==', email).limit(5))
          : null;

      let organization: Organization;
      const isNewOrg = !orgSnap.exists;
      if (isNewOrg) {
        organization = {
          id: orgId,
          name: SHARED_ORG_NAME,
          domain: normalizeEmailDomain(email),
          createdAt: now,
          updatedAt: now,
          settings: {
            defaultDailyCapPerMailbox: defaultDailyCapForEmail(email),
            defaultSendingWindow: { startHour: 9, endHour: 17, timezone: 'America/New_York' },
          },
        };
        tx.set(orgRef, organization);
      } else {
        organization = orgSnap.data() as Organization;
      }

      const invite = inviteSnap && !inviteSnap.empty ? (inviteSnap.docs[0].data() as Invite) : null;
      const placeholders = (placeholderSnap?.docs || []).filter(
        (d) => d.id !== uid && (d.data() as User).status === 'invited'
      );

      let user: User;
      if (userSnap.exists) {
        const existing = userSnap.data() as User;
        if (existing.status === 'inactive') {
          return { deactivated: true as const };
        }
        user = {
          ...existing,
          email: email || existing.email,
          displayName: tokenName || existing.displayName || displayName,
          photoURL: photoURL || existing.photoURL,
          role: ADMIN_EMAILS.has(email) ? 'admin' : invite?.role || existing.role,
          status: 'active',
          updatedAt: now,
        };
        tx.set(userRef, stripUndefined(user), { merge: true });
      } else {
        const placeholderRole = placeholders[0] ? (placeholders[0].data() as User).role : undefined;
        const role: UserRole = ADMIN_EMAILS.has(email)
          ? 'admin'
          : invite?.role || placeholderRole || (isNewOrg ? 'admin' : 'rep');
        user = {
          id: uid,
          orgId,
          email,
          displayName,
          ...(photoURL ? { photoURL } : {}),
          role,
          status: 'active',
          inboxStatus: 'disconnected',
          createdAt: now,
          updatedAt: now,
        };
        tx.set(userRef, user);
        placeholders.forEach((p) => tx.delete(p.ref));
      }

      if (invite) {
        tx.set(orgRef.collection('invites').doc(invite.id), { status: 'accepted', updatedAt: now }, { merge: true });
        tx.set(adminDb.collection('invites_index').doc(invite.id), { status: 'accepted', updatedAt: now }, { merge: true });
      }

      return { user, organization };
    });

    if ('deactivated' in result) {
      return NextResponse.json(
        { error: 'Your account has been deactivated. Ask a workspace admin to restore access.' },
        { status: 403 }
      );
    }

    if (decoded.orgId !== orgId || decoded.role !== result.user.role) {
      await adminAuth.setCustomUserClaims(uid, { orgId, role: result.user.role });
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Profile sync failed';
    console.error('Profile sync error:', message);
    const credentialProblem = describeAdminCredentialError(error);
    if (credentialProblem) {
      return NextResponse.json({ error: credentialProblem, code: 'server_credentials' }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function stripUndefined<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}
