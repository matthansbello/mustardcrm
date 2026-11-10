import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import type { MailboxToken } from '@/types';
import { getZohoAccessToken, markNeedsReauth } from './mailbox';
import { findZohoReplySince, ZohoApiError } from './providers/zoho';

/** How often an active Zoho enrollment is checked for replies between sends. */
export const ZOHO_REPLY_CHECK_INTERVAL_MS = 30 * 60 * 1000;

/**
 * Record that a contact replied: stop their enrollment, count the reply, move the contact
 * and their deals to "replied", and add it to the activity timeline. Mirrors the Gmail
 * Pub/Sub handler in functions/src/index.ts.
 */
export async function markEnrollmentReplied(params: {
  orgId: string;
  sequenceId: string;
  contactId: string;
  senderUserId?: string;
  replyId: string;
  source: string;
}): Promise<void> {
  const { orgId, sequenceId, contactId, senderUserId, replyId, source } = params;
  const org = adminDb.collection('organizations').doc(orgId);
  const now = new Date().toISOString();

  await org.collection('sequences').doc(sequenceId).collection('enrollments').doc(contactId).set(
    { status: 'replied', nextSendDueAt: null, repliedAt: now, updatedAt: now },
    { merge: true }
  );
  await org.collection('sequences').doc(sequenceId).update({ 'stats.replied': FieldValue.increment(1), updatedAt: now });
  await org.collection('stats').doc('summary').set({ replies: FieldValue.increment(1), updatedAt: now }, { merge: true });
  if (senderUserId) {
    await org
      .collection('stats')
      .doc(`rep_${senderUserId}`)
      .set({ userId: senderUserId, replies: FieldValue.increment(1), updatedAt: now }, { merge: true });
  }

  await org.collection('emailEvents').doc(`reply_${replyId}`).set({
    id: `reply_${replyId}`,
    orgId,
    sequenceId,
    contactId,
    type: 'reply',
    timestamp: now,
    metadata: { replyId, source },
  });

  const contactRef = org.collection('contacts').doc(contactId);
  await contactRef.set({ lifecycleStage: 'replied', updatedAt: now }, { merge: true });

  const deals = await org.collection('deals').where('contactId', '==', contactId).get();
  await Promise.all(deals.docs.map((d) => d.ref.update({ stage: 'replied', updatedAt: now })));

  await contactRef.collection('activity').doc(`act_reply_${replyId}`).set({
    id: `act_reply_${replyId}`,
    contactId,
    type: 'email_replied',
    title: 'Prospect replied',
    description: `Reply detected via ${source}`,
    timestamp: now,
  });
}

/**
 * Check a Zoho sender's mailbox for a reply from this contact since the enrollment's last
 * send. Returns true (and records the reply) when one is found.
 */
export async function checkZohoReply(params: {
  orgId: string;
  sequenceId: string;
  enrollmentId: string;
  contactId: string;
  contactEmail: string;
  senderUserId: string;
  mailbox: MailboxToken;
  lastSentAt: string;
}): Promise<boolean> {
  const { orgId, sequenceId, enrollmentId, contactId, contactEmail, senderUserId, mailbox, lastSentAt } = params;
  if (!mailbox.apiBase || !mailbox.zohoAccountId) return false;

  const enrollmentRef = adminDb
    .collection('organizations')
    .doc(orgId)
    .collection('sequences')
    .doc(sequenceId)
    .collection('enrollments')
    .doc(enrollmentId);

  try {
    const accessToken = await getZohoAccessToken(senderUserId, mailbox);
    const reply = await findZohoReplySince({
      apiBase: mailbox.apiBase,
      accessToken,
      accountId: mailbox.zohoAccountId,
      fromEmail: contactEmail,
      sinceMs: Date.parse(lastSentAt),
    });
    await enrollmentRef.set({ lastReplyCheckAt: new Date().toISOString() }, { merge: true });
    if (!reply) return false;

    await markEnrollmentReplied({
      orgId,
      sequenceId,
      contactId,
      senderUserId,
      replyId: `zoho_${reply.messageId}`,
      source: 'Zoho Mail',
    });
    return true;
  } catch (err) {
    if (err instanceof ZohoApiError && err.needsReauth) await markNeedsReauth(orgId, senderUserId);
    console.warn('Zoho reply check failed:', err instanceof Error ? err.message : err);
    return false;
  }
}
