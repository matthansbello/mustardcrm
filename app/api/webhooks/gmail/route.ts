import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Accepts either:
 * 1. Direct JSON: { contactId, sequenceId, orgId, replyMessage }
 * 2. Google Pub/Sub push envelope: { message: { data: base64 } }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    let contactId = body.contactId as string | undefined;
    let sequenceId = body.sequenceId as string | undefined;
    let orgId = (body.orgId as string | undefined) || undefined;
    let replyMessage = body.replyMessage as string | undefined;

    // Pub/Sub push format
    if (body.message?.data) {
      const decoded = JSON.parse(Buffer.from(body.message.data, 'base64').toString('utf8'));
      contactId = contactId || decoded.contactId;
      sequenceId = sequenceId || decoded.sequenceId;
      orgId = orgId || decoded.orgId;
      replyMessage = replyMessage || decoded.replyMessage;
      // Gmail watch payloads have emailAddress + historyId — handled primarily by CF
      if (decoded.emailAddress && !contactId) {
        return NextResponse.json({
          success: true,
          status: 'delegated_to_cloud_function',
          emailAddress: decoded.emailAddress,
        });
      }
    }

    if (!orgId || !contactId || !sequenceId) {
      return NextResponse.json({ error: 'Missing orgId, contactId, or sequenceId' }, { status: 400 });
    }

    const now = new Date().toISOString();

    await adminDb
      .collection('organizations')
      .doc(orgId)
      .collection('sequences')
      .doc(sequenceId)
      .collection('enrollments')
      .doc(contactId)
      .set({ status: 'replied', nextSendDueAt: null, updatedAt: now }, { merge: true });

    await adminDb
      .collection('organizations')
      .doc(orgId)
      .collection('sequences')
      .doc(sequenceId)
      .update({ 'stats.replied': FieldValue.increment(1) });

    const dealsQuery = await adminDb
      .collection('organizations')
      .doc(orgId)
      .collection('deals')
      .where('contactId', '==', contactId)
      .get();

    const batch = adminDb.batch();
    dealsQuery.docs.forEach((dealDoc) => {
      batch.update(dealDoc.ref, { stage: 'replied', updatedAt: now });
    });
    await batch.commit();

    const activityId = `act_reply_${Date.now()}`;
    await adminDb
      .collection('organizations')
      .doc(orgId)
      .collection('contacts')
      .doc(contactId)
      .collection('activity')
      .doc(activityId)
      .set({
        id: activityId,
        contactId,
        type: 'email_replied',
        title: 'Prospect Replied in Thread',
        description: replyMessage || 'Reply detected via Gmail webhook',
        timestamp: now,
      });

    await adminDb
      .collection('organizations')
      .doc(orgId)
      .collection('contacts')
      .doc(contactId)
      .set({ lifecycleStage: 'replied', updatedAt: now }, { merge: true });

    await adminDb
      .collection('organizations')
      .doc(orgId)
      .collection('emailEvents')
      .doc(`reply_${contactId}_${Date.now()}`)
      .set({
        id: `reply_${contactId}_${Date.now()}`,
        orgId,
        sequenceId,
        contactId,
        type: 'reply',
        timestamp: now,
      });

    await adminDb
      .collection('organizations')
      .doc(orgId)
      .collection('stats')
      .doc('summary')
      .set({ replies: FieldValue.increment(1), updatedAt: now }, { merge: true });

    return NextResponse.json({ success: true, status: 'processed' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Webhook failed';
    console.error('Error handling Gmail push notification:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
