import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { personalize, sendSequenceEmail } from '@/lib/email/sender';
import { getMailbox } from '@/lib/email/mailbox';
import { checkZohoReply, ZOHO_REPLY_CHECK_INTERVAL_MS } from '@/lib/email/replies';

/**
 * HTTP cron for sequence sends when Cloud Functions aren't deployed.
 * Protect with CRON_SECRET header: x-cron-secret
 *
 * For each active enrollment: Zoho senders are checked for replies (Zoho has no push
 * notifications), then due steps are sent from the sender's Gmail or Zoho mailbox.
 */
export async function POST(request: Request) {
  const secret = request.headers.get('x-cron-secret');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const nowIso = new Date().toISOString();
  let processed = 0;
  let replies = 0;
  const errors: string[] = [];
  const mailboxes = new Map<string, Awaited<ReturnType<typeof getMailbox>>>();
  const mailboxFor = async (uid: string) => {
    if (!mailboxes.has(uid)) mailboxes.set(uid, await getMailbox(uid));
    return mailboxes.get(uid)!;
  };

  const orgs = await adminDb.collection('organizations').get();

  for (const orgDoc of orgs.docs) {
    const orgId = orgDoc.id;
    const org = adminDb.collection('organizations').doc(orgId);
    const sequences = await org.collection('sequences').where('status', '==', 'active').get();

    for (const seqDoc of sequences.docs) {
      const sequence = seqDoc.data();
      const senderUserId: string | undefined = sequence.settings?.senderUserIds?.[0];
      if (!senderUserId) continue;

      const enrollments = await seqDoc.ref.collection('enrollments').where('status', '==', 'active').get();

      for (const enrDoc of enrollments.docs) {
        const enrollment = enrDoc.data();
        const due = Boolean(enrollment.nextSendDueAt && enrollment.nextSendDueAt <= nowIso);
        const lastSentAt: string | undefined = enrollment.history?.[enrollment.history.length - 1]?.sentAt;

        try {
          const mailbox = await mailboxFor(senderUserId);

          // Zoho reply detection: always before sending a follow-up, otherwise every 30 minutes.
          if (mailbox?.provider === 'zoho' && lastSentAt) {
            const lastCheck = Date.parse(enrollment.lastReplyCheckAt || '') || 0;
            if (due || Date.now() - lastCheck > ZOHO_REPLY_CHECK_INTERVAL_MS) {
              const contactSnap = await org.collection('contacts').doc(enrollment.contactId).get();
              const replied =
                contactSnap.exists &&
                (await checkZohoReply({
                  orgId,
                  sequenceId: seqDoc.id,
                  enrollmentId: enrDoc.id,
                  contactId: enrollment.contactId,
                  contactEmail: contactSnap.get('email'),
                  senderUserId,
                  mailbox: mailbox.data,
                  lastSentAt,
                }));
              if (replied) {
                replies++;
                continue;
              }
            }
          }

          if (!due) continue;
          const stepIndex = enrollment.currentStepIndex || 0;
          const step = sequence.steps?.[stepIndex];
          if (!step) continue;

          const [contactSnap, senderSnap] = await Promise.all([
            org.collection('contacts').doc(enrollment.contactId).get(),
            org.collection('users').doc(senderUserId).get(),
          ]);
          if (!contactSnap.exists || !senderSnap.exists) continue;
          if (senderSnap.get('inboxStatus') !== 'connected') continue;

          const contact = contactSnap.data()!;
          const sender = senderSnap.data()!;
          const tokens = {
            firstName: contact.firstName,
            companyName: contact.companyName,
            title: contact.title,
            lastName: contact.lastName,
          };
          const sendAttemptId = `${seqDoc.id}_${enrollment.contactId}_${stepIndex}`;

          const result = await sendSequenceEmail({
            orgId,
            userId: senderUserId,
            senderEmail: sender.sendingEmail || sender.email,
            recipientEmail: contact.email,
            subject: personalize(step.subject, tokens),
            bodyHtml: personalize(step.body, tokens),
            sequenceId: seqDoc.id,
            contactId: enrollment.contactId,
            stepIndex,
            sendAttemptId,
          });
          if (result.status === 'in_flight') continue;

          const nextIndex = stepIndex + 1;
          const history = [
            ...(enrollment.history || []),
            { stepIndex, sentAt: new Date().toISOString(), sendAttemptId, senderUserId },
          ];

          if (nextIndex >= (sequence.steps?.length || 0)) {
            await enrDoc.ref.update({
              status: 'completed',
              currentStepIndex: nextIndex,
              nextSendDueAt: null,
              history,
              lastSendAttemptId: sendAttemptId,
              updatedAt: nowIso,
            });
          } else {
            const delayDays = sequence.steps[nextIndex].dayDelay || 0;
            await enrDoc.ref.update({
              currentStepIndex: nextIndex,
              nextSendDueAt: new Date(Date.now() + delayDays * 86400000).toISOString(),
              history,
              lastSendAttemptId: sendAttemptId,
              updatedAt: nowIso,
            });
          }

          if (result.status === 'sent') {
            await seqDoc.ref.update({ 'stats.sent': FieldValue.increment(1) });
            await org.collection('stats').doc('summary').set({ emailsSent: FieldValue.increment(1) }, { merge: true });
            await org
              .collection('stats')
              .doc(`rep_${senderUserId}`)
              .set({ userId: senderUserId, emailsSent: FieldValue.increment(1) }, { merge: true });
            if (!contact.lifecycleStage || contact.lifecycleStage === 'lead') {
              await contactSnap.ref.set({ lifecycleStage: 'contacted', updatedAt: nowIso }, { merge: true });
            }
            processed++;
          }
        } catch (err) {
          errors.push(err instanceof Error ? err.message : 'send_failed');
        }
      }
    }
  }

  return NextResponse.json({ processed, replies, errors });
}
