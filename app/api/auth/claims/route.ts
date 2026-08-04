import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';

/**
 * Sync Firebase custom claims for role-based access.
 * Body: { orgId, role }
 * Auth: Bearer <Firebase ID token>
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.slice(7);
    const decoded = await adminAuth.verifyIdToken(idToken);
    const body = await request.json();
    const { orgId, role } = body;

    if (!orgId || !role) {
      return NextResponse.json({ error: 'Missing orgId or role' }, { status: 400 });
    }

    if (!['admin', 'manager', 'rep'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    await adminAuth.setCustomUserClaims(decoded.uid, {
      orgId,
      role,
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Claims sync failed';
    console.error('Claims sync error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
