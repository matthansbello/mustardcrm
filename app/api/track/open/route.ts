import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('eventId');
  const orgId = searchParams.get('orgId');
  const sequenceId = searchParams.get('sequenceId') || '';
  const contactId = searchParams.get('contactId') || '';

  if (eventId && orgId) {
    try {
      const openId = `open_${eventId}`;
      const openRef = adminDb
        .collection('organizations')
        .doc(orgId)
        .collection('emailEvents')
        .doc(openId);
      const existing = await openRef.get();

      if (!existing.exists) {
        let resolvedSequenceId = sequenceId;
        let resolvedContactId = contactId;

        if (!resolvedSequenceId || !resolvedContactId) {
          const parent = await adminDb
            .collection('organizations')
            .doc(orgId)
            .collection('emailEvents')
            .doc(eventId)
            .get();
          resolvedSequenceId = resolvedSequenceId || parent.data()?.sequenceId || '';
          resolvedContactId = resolvedContactId || parent.data()?.contactId || '';
        }

        await openRef.set({
          id: openId,
          orgId,
          sequenceId: resolvedSequenceId,
          contactId: resolvedContactId,
          type: 'open',
          timestamp: new Date().toISOString(),
          metadata: { parentEventId: eventId },
        });

        if (resolvedSequenceId) {
          await adminDb
            .collection('organizations')
            .doc(orgId)
            .collection('sequences')
            .doc(resolvedSequenceId)
            .update({ 'stats.opened': FieldValue.increment(1) });
        }

        await adminDb
          .collection('organizations')
          .doc(orgId)
          .collection('stats')
          .doc('summary')
          .set({ opens: FieldValue.increment(1), updatedAt: new Date().toISOString() }, { merge: true });

        if (resolvedContactId) {
          const activityId = `act_open_${eventId}`;
          await adminDb
            .collection('organizations')
            .doc(orgId)
            .collection('contacts')
            .doc(resolvedContactId)
            .collection('activity')
            .doc(activityId)
            .set({
              id: activityId,
              contactId: resolvedContactId,
              type: 'email_opened',
              title: 'Email opened',
              timestamp: new Date().toISOString(),
            });
        }
      }
    } catch (error) {
      console.warn('Error logging open tracking pixel:', error);
    }
  }

  const transparentGif = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64'
  );

  return new NextResponse(transparentGif, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': transparentGif.length.toString(),
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    },
  });
}
