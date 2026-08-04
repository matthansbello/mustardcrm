import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { personalize, sendSequenceEmail } from '@/lib/email/sender';

/**
 * Dev/prod HTTP cron for sequence sends when Cloud Functions aren't deployed.
 * Protect with CRON_SECRET header: x-cron-secret
 */
export async function POST(request: Request) {
  const secret = request.headers.get('x-cron-secret');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const nowIso = new Date().toISOString();
  let processed = 0;
  const errors: string[] = [];

  const orgs = await adminDb.collection('organizations').get();

  for (const orgDoc of orgs.docs) {
    const orgId = orgDoc.id;
    const sequences = await adminDb
      .collection('organizations')
      .doc(orgId)
      .collection('sequences')
      .where('status', '==', 'active')
      .get();

    for (const seqDoc of sequences.docs) {
      const sequence = seqDoc.data();
      const enrollments = await seqDoc.ref
        .collection('enrollments')
        .where('status', '==', 'active')
        .get();

      for (const enrDoc of enrollments.docs) {
        const enrollment = enrDoc.data();
        if (!enrollment.nextSendDueAt || enrollment.nextSendDueAt > nowIso) continue;

        const stepIndex = enrollment.currentStepIndex || 0;
        const step = sequence.steps?.[stepIndex];
        if (!step) continue;

        const senderUserId = sequence.settings?.senderUserIds?.[0];
        if (!senderUserId) continue;

        try {
          const [contactSnap, senderSnap] = await Promise.all([
            adminDb.collection('organizations').doc(orgId).collection('contacts').doc(enrollment.contactId).get(),
            adminDb.collection('organizations').doc(orgId).collection('users').doc(senderUserId).get(),
          ]);
          if (!contactSnap.exists || !senderSnap.exists) continue;

          const contact = contactSnap.data()!;
          const sender = senderSnap.data()!;
          const sendAttemptId = `${seqDoc.id}_${enrollment.contactId}_${stepIndex}`;

          await sendSequenceEmail({
            orgId,
            userId: senderUserId,
            senderEmail: sender.email,
            recipientEmail: contact.email,
            subject: personalize(step.subject, {
              firstName: contact.firstName,
              companyName: contact.companyName,
              title: contact.title,
              lastName: contact.lastName,
            }),
            bodyHtml: personalize(step.body, {
              firstName: contact.firstName,
              companyName: contact.companyName,
              title: contact.title,
              lastName: contact.lastName,
            }),
            sequenceId: seqDoc.id,
            contactId: contact.id,
            stepIndex,
            sendAttemptId,
          });

          const nextIndex = stepIndex + 1;
          const history = [
            ...(enrollment.history || []),
            {
              stepIndex,
              sentAt: nowIso,
              sendAttemptId,
            },
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
            const due = new Date(Date.now() + delayDays * 86400000).toISOString();
            await enrDoc.ref.update({
              currentStepIndex: nextIndex,
              nextSendDueAt: due,
              history,
              lastSendAttemptId: sendAttemptId,
              updatedAt: nowIso,
            });
          }

          await seqDoc.ref.update({ 'stats.sent': (sequence.stats?.sent || 0) + 1 });
          processed++;
        } catch (err) {
          errors.push(err instanceof Error ? err.message : 'send_failed');
        }
      }
    }
  }

  return NextResponse.json({ processed, errors });
}
