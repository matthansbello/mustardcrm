import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('eventId');
  const targetUrl = searchParams.get('targetUrl');
  const orgId = searchParams.get('orgId');
  const sequenceId = searchParams.get('sequenceId') || '';
  const contactId = searchParams.get('contactId') || '';

  if (eventId && orgId && targetUrl) {
    try {
      const clickEventId = `click_${eventId}_${Date.now()}`;
      await adminDb
        .collection('organizations')
        .doc(orgId)
        .collection('emailEvents')
        .doc(clickEventId)
        .set({
          id: clickEventId,
          orgId,
          sequenceId,
          contactId,
          type: 'click',
          timestamp: new Date().toISOString(),
          metadata: { parentEventId: eventId, targetUrl },
        });

      if (sequenceId) {
        await adminDb
          .collection('organizations')
          .doc(orgId)
          .collection('sequences')
          .doc(sequenceId)
          .update({ 'stats.clicked': FieldValue.increment(1) });
      }

      await adminDb
        .collection('organizations')
        .doc(orgId)
        .collection('stats')
        .doc('summary')
        .set({ clicks: FieldValue.increment(1), updatedAt: new Date().toISOString() }, { merge: true });
    } catch (error) {
      console.warn('Error logging click redirect:', error);
    }
  }

  const destination = targetUrl || '/';
  return NextResponse.redirect(destination, 302);
}
