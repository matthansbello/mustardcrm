import * as admin from 'firebase-admin';
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onMessagePublished } from 'firebase-functions/v2/pubsub';
import { google } from 'googleapis';
import * as crypto from 'crypto';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// ---------- Crypto ----------
function getEncryptionKey(): string {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key || key.length < 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be set (min 32 chars)');
  }
  return key;
}

function decryptToken(encryptedText: string): string {
  if (encryptedText.startsWith('b64:')) {
    return Buffer.from(encryptedText.slice(4), 'base64').toString('utf8');
  }
  const [ivHex, encrypted] = encryptedText.split(':');
  const key = crypto.scryptSync(getEncryptionKey(), 'mustard-token-salt-v1', 32);
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function encryptToken(text: string): string {
  const key = crypto.scryptSync(getEncryptionKey(), 'mustard-token-salt-v1', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

type DocData = Record<string, any>;

function personalize(text: string, contact: DocData): string {
  return text
    .replace(/\{\{first_name\}\}/gi, contact.firstName || '')
    .replace(/\{\{company\}\}/gi, contact.companyName || '')
    .replace(/\{\{title\}\}/gi, contact.title || '')
    .replace(/\{\{last_name\}\}/gi, contact.lastName || '');
}

function createRawMime(opts: {
  from: string;
  to: string;
  subject: string;
  bodyHtml: string;
  eventId: string;
  orgId: string;
  sequenceId: string;
  contactId: string;
}): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';
  const params = new URLSearchParams({
    eventId: opts.eventId,
    orgId: opts.orgId,
    sequenceId: opts.sequenceId,
    contactId: opts.contactId,
  });
  const pixel = `<img src="${baseUrl}/api/track/open?${params}" width="1" height="1" style="display:none" alt="" />`;
  let html = opts.bodyHtml.includes('<')
    ? opts.bodyHtml
    : opts.bodyHtml.replace(/\n/g, '<br/>');
  html = html.replace(/href="(https?:\/\/[^"]+)"/g, (_, url) => {
    const p = new URLSearchParams(params);
    p.set('targetUrl', url);
    return `href="${baseUrl}/api/track/click?${p}"`;
  });
  const mime = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    `${html}\n${pixel}`,
  ].join('\r\n');
  return Buffer.from(mime).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function bumpStats(
  orgId: string,
  sequenceId: string,
  field: 'sent' | 'opened' | 'clicked' | 'replied' | 'bounced',
  senderUserId?: string
) {
  const seqRef = db.collection('organizations').doc(orgId).collection('sequences').doc(sequenceId);
  await seqRef.update({
    [`stats.${field}`]: admin.firestore.FieldValue.increment(1),
    updatedAt: new Date().toISOString(),
  });

  const statsRef = db.collection('organizations').doc(orgId).collection('stats').doc('summary');
  const map: Record<string, string> = {
    sent: 'emailsSent',
    opened: 'opens',
    clicked: 'clicks',
    replied: 'replies',
    bounced: 'bounces',
  };
  await statsRef.set(
    {
      [map[field]]: admin.firestore.FieldValue.increment(1),
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  if (senderUserId && field === 'sent') {
    await db
      .collection('organizations')
      .doc(orgId)
      .collection('stats')
      .doc(`rep_${senderUserId}`)
      .set(
        {
          userId: senderUserId,
          emailsSent: admin.firestore.FieldValue.increment(1),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
  }
  if (senderUserId && field === 'replied') {
    await db
      .collection('organizations')
      .doc(orgId)
      .collection('stats')
      .doc(`rep_${senderUserId}`)
      .set(
        {
          userId: senderUserId,
          replies: admin.firestore.FieldValue.increment(1),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
  }
}

function isWithinSendingWindow(
  window: { startHour: number; endHour: number; timezone: string }
): boolean {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: window.timezone || 'UTC',
      hour: 'numeric',
      hour12: false,
    });
    const hour = Number(formatter.format(new Date()));
    return hour >= window.startHour && hour < window.endHour;
  } catch {
    const hour = new Date().getUTCHours();
    return hour >= window.startHour && hour < window.endHour;
  }
}

async function getDailySendCount(orgId: string, userId: string): Promise<number> {
  const dayKey = new Date().toISOString().slice(0, 10);
  const snap = await db
    .collection('organizations')
    .doc(orgId)
    .collection('mailboxCaps')
    .doc(`${userId}_${dayKey}`)
    .get();
  return snap.exists ? Number(snap.data()?.count || 0) : 0;
}

async function incrementDailySendCount(orgId: string, userId: string): Promise<void> {
  const dayKey = new Date().toISOString().slice(0, 10);
  await db
    .collection('organizations')
    .doc(orgId)
    .collection('mailboxCaps')
    .doc(`${userId}_${dayKey}`)
    .set(
      {
        userId,
        dayKey,
        count: admin.firestore.FieldValue.increment(1),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
}

async function sendOneEnrollment(params: {
  orgId: string;
  sequenceId: string;
  sequence: DocData;
  enrollmentId: string;
  enrollment: DocData;
}): Promise<boolean> {
  const { orgId, sequenceId, sequence, enrollmentId, enrollment } = params;
  const stepIndex = enrollment.currentStepIndex || 0;
  const step = sequence.steps?.[stepIndex];
  if (!step) {
    await db
      .collection('organizations')
      .doc(orgId)
      .collection('sequences')
      .doc(sequenceId)
      .collection('enrollments')
      .doc(enrollmentId)
      .update({ status: 'completed', nextSendDueAt: null, updatedAt: new Date().toISOString() });
    return false;
  }

  const senderUserIds: string[] = sequence.settings?.senderUserIds || [];
  if (!senderUserIds.length) return false;

  const dailyCap = sequence.settings?.dailyCapPerMailbox || 50;
  let senderUserId: string | null = null;
  for (const uid of senderUserIds) {
    const count = await getDailySendCount(orgId, uid);
    if (count < dailyCap) {
      senderUserId = uid;
      break;
    }
  }
  if (!senderUserId) return false;

  if (sequence.settings?.sendingWindow && !isWithinSendingWindow(sequence.settings.sendingWindow)) {
    return false;
  }

  const contactSnap = await db
    .collection('organizations')
    .doc(orgId)
    .collection('contacts')
    .doc(enrollment.contactId)
    .get();
  if (!contactSnap.exists) return false;
  const contact = contactSnap.data()!;

  const senderSnap = await db
    .collection('organizations')
    .doc(orgId)
    .collection('users')
    .doc(senderUserId)
    .get();
  if (!senderSnap.exists) return false;
  const sender = senderSnap.data()!;
  if (sender.inboxStatus !== 'connected') return false;

  const sendAttemptId = `${sequenceId}_${enrollment.contactId}_${stepIndex}`;
  const attemptRef = db
    .collection('organizations')
    .doc(orgId)
    .collection('sendAttempts')
    .doc(sendAttemptId);
  if ((await attemptRef.get()).exists) {
    // Already sent — advance enrollment
    await advanceEnrollment(orgId, sequenceId, enrollmentId, enrollment, step, sendAttemptId, undefined);
    return true;
  }

  await attemptRef.set({
    sendAttemptId,
    status: 'sending',
    claimedAt: new Date().toISOString(),
  });

  try {
    const tokenDoc = await db.collection('tokens').doc(senderUserId).get();
    if (!tokenDoc.exists) throw new Error('token_missing');
    const refreshToken = decryptToken(tokenDoc.data()!.encryptedRefreshToken);

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await oauth2Client.refreshAccessToken();
    if (credentials.access_token) {
      await db.collection('tokens').doc(senderUserId).set(
        {
          encryptedAccessToken: encryptToken(credentials.access_token),
          expiresAt: credentials.expiry_date || null,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    }

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const subject = personalize(step.subject, contact);
    const body = personalize(step.body, contact);
    const eventId = `evt_${sendAttemptId}`;
    const raw = createRawMime({
      from: sender.email,
      to: contact.email,
      subject,
      bodyHtml: body,
      eventId,
      orgId,
      sequenceId,
      contactId: contact.id,
    });

    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });

    const messageId = response.data.id || '';
    const now = new Date().toISOString();

    await attemptRef.set({
      sendAttemptId,
      status: 'sent',
      messageId,
      sentAt: now,
      sequenceId,
      contactId: contact.id,
      stepIndex,
    });

    await db
      .collection('organizations')
      .doc(orgId)
      .collection('emailEvents')
      .doc(eventId)
      .set({
        id: eventId,
        orgId,
        sequenceId,
        contactId: contact.id,
        stepIndex,
        type: 'sent',
        timestamp: now,
        metadata: {
          messageId,
          threadId: response.data.threadId || null,
          senderEmail: sender.email,
          recipientEmail: contact.email,
        },
      });

    await incrementDailySendCount(orgId, senderUserId);
    await bumpStats(orgId, sequenceId, 'sent', senderUserId);
    await advanceEnrollment(orgId, sequenceId, enrollmentId, enrollment, step, sendAttemptId, messageId);

    // Update contact lifecycle
    await contactSnap.ref.set(
      { lifecycleStage: 'contacted', updatedAt: now },
      { merge: true }
    );

    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'send_failed';
    await attemptRef.set({ status: 'failed', error: message }, { merge: true });
    if (message.includes('invalid_grant') || message.includes('token')) {
      await senderSnap.ref.set(
        { inboxStatus: 'needs_reauth', updatedAt: new Date().toISOString() },
        { merge: true }
      );
    }
    console.error('Send failed:', message);
    return false;
  }
}

async function advanceEnrollment(
  orgId: string,
  sequenceId: string,
  enrollmentId: string,
  enrollment: DocData,
  step: DocData,
  sendAttemptId: string,
  messageId?: string
) {
  const now = new Date();
  const history = [
    ...(enrollment.history || []),
    {
      stepIndex: enrollment.currentStepIndex || 0,
      sentAt: now.toISOString(),
      messageId: messageId || null,
      sendAttemptId,
    },
  ];
  const nextIndex = (enrollment.currentStepIndex || 0) + 1;
  const seqSnap = await db
    .collection('organizations')
    .doc(orgId)
    .collection('sequences')
    .doc(sequenceId)
    .get();
  const steps = seqSnap.data()?.steps || [];

  if (nextIndex >= steps.length) {
    await db
      .collection('organizations')
      .doc(orgId)
      .collection('sequences')
      .doc(sequenceId)
      .collection('enrollments')
      .doc(enrollmentId)
      .update({
        status: 'completed',
        currentStepIndex: nextIndex,
        nextSendDueAt: null,
        history,
        lastSendAttemptId: sendAttemptId,
        updatedAt: now.toISOString(),
      });
    return;
  }

  const nextStep = steps[nextIndex];
  const due = new Date(now.getTime() + (nextStep.dayDelay || 0) * 24 * 60 * 60 * 1000);

  await db
    .collection('organizations')
    .doc(orgId)
    .collection('sequences')
    .doc(sequenceId)
    .collection('enrollments')
    .doc(enrollmentId)
    .update({
      currentStepIndex: nextIndex,
      nextSendDueAt: due.toISOString(),
      history,
      lastSendAttemptId: sendAttemptId,
      updatedAt: now.toISOString(),
    });
}

async function runSequenceTick(): Promise<{ processed: number }> {
  const orgs = await db.collection('organizations').get();
  let processed = 0;
  const nowIso = new Date().toISOString();

  for (const orgDoc of orgs.docs) {
    const orgId = orgDoc.id;
    const sequences = await db
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

        const sent = await sendOneEnrollment({
          orgId,
          sequenceId: seqDoc.id,
          sequence,
          enrollmentId: enrDoc.id,
          enrollment,
        });
        if (sent) processed++;
      }
    }
  }

  return { processed };
}

/**
 * Scheduled sequence tick — every 5 minutes
 */
export const onSequenceTick = onSchedule(
  { schedule: 'every 5 minutes', timeoutSeconds: 540, memory: '512MiB' },
  async () => {
    const result = await runSequenceTick();
    console.log('onSequenceTick processed', result.processed);
  }
);

/**
 * HTTP trigger for local/dev cron (protected by CRON_SECRET)
 */
export const sequenceTickHttp = onRequest({ timeoutSeconds: 540 }, async (req, res) => {
  const secret = req.get('x-cron-secret') || req.query.secret;
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    res.status(401).send('Unauthorized');
    return;
  }
  const result = await runSequenceTick();
  res.json(result);
});

/**
 * Import job processor — triggered when importJobs doc is created
 */
export const onImportJobCreated = onDocumentCreated(
  'organizations/{orgId}/importJobs/{jobId}',
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const job = snap.data();
    const orgId = event.params.orgId;
    const jobId = event.params.jobId;
    const jobRef = snap.ref;

    await jobRef.update({ status: 'validating', updatedAt: new Date().toISOString() });

    try {
      const bucket = admin.storage().bucket();
      const [buffer] = await bucket.file(job.storagePath).download();
      const Papa = await import('papaparse');
      const XLSX = await import('xlsx');

      let rows: Record<string, string>[] = [];
      const fileName: string = job.fileName || '';

      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, string>[];
      } else {
        const parsed = Papa.parse(buffer.toString('utf8'), {
          header: true,
          skipEmptyLines: true,
        });
        rows = parsed.data as Record<string, string>[];
      }

      const mapping: Record<string, string> = job.columnMapping || {};
      const existingEmails = new Set<string>();
      const existingSnap = await db.collection('organizations').doc(orgId).collection('contacts').select('email').get();
      existingSnap.forEach((d) => existingEmails.add((d.data().email || '').toLowerCase()));

      await jobRef.update({
        status: 'importing',
        totalRows: rows.length,
        updatedAt: new Date().toISOString(),
      });

      let validCount = 0;
      let duplicateCount = 0;
      let errorCount = 0;
      let processedRows = 0;
      const errors: string[] = [];
      const now = new Date().toISOString();
      const chunk: DocData[] = [];

      const flush = async () => {
        if (!chunk.length) return;
        const batch = db.batch();
        chunk.forEach((c) => {
          const ref = db.collection('organizations').doc(orgId).collection('contacts').doc(c.id);
          batch.set(ref, c);
        });
        await batch.commit();
        chunk.length = 0;
      };

      for (const row of rows) {
        processedRows++;
        const get = (field: string) => {
          const header = Object.keys(mapping).find((k) => mapping[k] === field) || field;
          return String(row[header] || row[field] || '').trim();
        };

        const email = get('email').toLowerCase();
        if (!email || !email.includes('@')) {
          errorCount++;
          errors.push(`Row ${processedRows}: invalid email`);
          continue;
        }
        if (existingEmails.has(email)) {
          duplicateCount++;
          continue;
        }
        existingEmails.add(email);

        const contactId = `contact_${Date.now()}_${processedRows}_${Math.random().toString(36).slice(2, 6)}`;
        chunk.push({
          id: contactId,
          orgId,
          email,
          firstName: get('firstName') || email.split('@')[0],
          lastName: get('lastName') || '',
          phone: get('phone') || '',
          title: get('title') || '',
          companyName: get('companyName') || '',
          tags: ['csv_import'],
          ownerId: job.ownerId || '',
          lifecycleStage: 'lead',
          customFields: {},
          createdAt: now,
          updatedAt: now,
        });
        validCount++;

        if (chunk.length >= 400) {
          await flush();
          await jobRef.update({
            processedRows,
            validCount,
            duplicateCount,
            errorCount,
            updatedAt: new Date().toISOString(),
          });
        }
      }
      await flush();

      let errorReportUrl: string | undefined;
      if (errors.length) {
        const reportPath = `organizations/${orgId}/error-reports/${jobId}.txt`;
        const file = bucket.file(reportPath);
        await file.save(errors.join('\n'), { contentType: 'text/plain' });
        errorReportUrl = reportPath;
      }

      await jobRef.update({
        status: 'completed',
        processedRows,
        validCount,
        duplicateCount,
        errorCount,
        errorReportUrl: errorReportUrl || null,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'import_failed';
      console.error('Import failed:', message);
      await jobRef.update({
        status: 'failed',
        errorMessage: message,
        updatedAt: new Date().toISOString(),
      });
    }
  }
);

/**
 * Open tracking pixel
 */
export const trackOpen = onRequest(async (req, res) => {
  const eventId = String(req.query.eventId || '');
  const orgId = String(req.query.orgId || '');
  const sequenceId = String(req.query.sequenceId || '');
  const contactId = String(req.query.contactId || '');

  if (eventId && orgId) {
    try {
      const parent = await db
        .collection('organizations')
        .doc(orgId)
        .collection('emailEvents')
        .doc(eventId)
        .get();
      const openId = `open_${eventId}`;
      const existing = await db
        .collection('organizations')
        .doc(orgId)
        .collection('emailEvents')
        .doc(openId)
        .get();
      if (!existing.exists) {
        await db
          .collection('organizations')
          .doc(orgId)
          .collection('emailEvents')
          .doc(openId)
          .set({
            id: openId,
            orgId,
            sequenceId: sequenceId || parent.data()?.sequenceId || '',
            contactId: contactId || parent.data()?.contactId || '',
            type: 'open',
            timestamp: new Date().toISOString(),
            metadata: { parentEventId: eventId },
          });
        if (sequenceId || parent.data()?.sequenceId) {
          await bumpStats(orgId, sequenceId || parent.data()!.sequenceId, 'opened');
        }
      }
    } catch (e) {
      console.warn('trackOpen error', e);
    }
  }

  const gif = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64'
  );
  res.set('Content-Type', 'image/gif');
  res.set('Cache-Control', 'no-store');
  res.status(200).send(gif);
});

/**
 * Click tracking redirect
 */
export const trackClick = onRequest(async (req, res) => {
  const eventId = String(req.query.eventId || '');
  const orgId = String(req.query.orgId || '');
  const sequenceId = String(req.query.sequenceId || '');
  const contactId = String(req.query.contactId || '');
  const targetUrl = String(req.query.targetUrl || '/');

  if (eventId && orgId) {
    try {
      const clickId = `click_${eventId}_${Date.now()}`;
      await db
        .collection('organizations')
        .doc(orgId)
        .collection('emailEvents')
        .doc(clickId)
        .set({
          id: clickId,
          orgId,
          sequenceId,
          contactId,
          type: 'click',
          timestamp: new Date().toISOString(),
          metadata: { parentEventId: eventId, targetUrl },
        });
      if (sequenceId) await bumpStats(orgId, sequenceId, 'clicked');
    } catch (e) {
      console.warn('trackClick error', e);
    }
  }

  res.redirect(302, targetUrl);
});

/**
 * Gmail Pub/Sub push — reply detection
 */
export const onGmailPushNotification = onMessagePublished('gmail-push', async (event) => {
  const data = event.data.message.json as { emailAddress?: string; historyId?: string } | undefined;
  if (!data?.emailAddress) {
    console.log('No emailAddress in push payload');
    return;
  }

  // Find user by email across orgs (mailbox owner)
  const usersGroup = await db.collectionGroup('users').where('email', '==', data.emailAddress).limit(1).get();
  if (usersGroup.empty) {
    console.log('No user for', data.emailAddress);
    return;
  }

  const userDoc = usersGroup.docs[0];
  const user = userDoc.data();
  const orgId = user.orgId;
  const userId = user.id;

  const tokenDoc = await db.collection('tokens').doc(userId).get();
  if (!tokenDoc.exists) return;

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({
    refresh_token: decryptToken(tokenDoc.data()!.encryptedRefreshToken),
  });
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // List recent inbox messages (replies)
  const list = await gmail.users.messages.list({
    userId: 'me',
    q: 'is:inbox newer_than:1d',
    maxResults: 20,
  });

  for (const msg of list.data.messages || []) {
    if (!msg.id) continue;
    const full = await gmail.users.messages.get({
      userId: 'me',
      id: msg.id,
      format: 'metadata',
      metadataHeaders: ['From', 'In-Reply-To', 'References', 'Subject'],
    });
    const headers = full.data.payload?.headers || [];
    const from = headers.find((h) => h.name === 'From')?.value || '';
    const emailMatch = from.match(/<([^>]+)>/) || from.match(/([^\s]+@[^\s]+)/);
    const fromEmail = (emailMatch?.[1] || '').toLowerCase();
    if (!fromEmail) continue;

    const contacts = await db
      .collection('organizations')
      .doc(orgId)
      .collection('contacts')
      .where('email', '==', fromEmail)
      .limit(1)
      .get();
    if (contacts.empty) continue;
    const contact = contacts.docs[0].data();

    // Find active enrollment for this contact
    const sequences = await db
      .collection('organizations')
      .doc(orgId)
      .collection('sequences')
      .where('status', '==', 'active')
      .get();

    for (const seq of sequences.docs) {
      const enr = await seq.ref.collection('enrollments').doc(contact.id).get();
      if (!enr.exists || enr.data()?.status !== 'active') continue;

      const now = new Date().toISOString();
      await enr.ref.update({ status: 'replied', nextSendDueAt: null, updatedAt: now });
      await bumpStats(orgId, seq.id, 'replied', userId);

      await db
        .collection('organizations')
        .doc(orgId)
        .collection('emailEvents')
        .doc(`reply_${msg.id}`)
        .set({
          id: `reply_${msg.id}`,
          orgId,
          sequenceId: seq.id,
          contactId: contact.id,
          type: 'reply',
          timestamp: now,
          metadata: { gmailMessageId: msg.id },
        });

      await contacts.docs[0].ref.set(
        { lifecycleStage: 'replied', updatedAt: now },
        { merge: true }
      );

      const deals = await db
        .collection('organizations')
        .doc(orgId)
        .collection('deals')
        .where('contactId', '==', contact.id)
        .get();
      for (const d of deals.docs) {
        await d.ref.update({ stage: 'replied', updatedAt: now });
      }

      await contacts.docs[0].ref.collection('activity').doc(`act_reply_${msg.id}`).set({
        id: `act_reply_${msg.id}`,
        contactId: contact.id,
        type: 'email_replied',
        title: 'Prospect Replied',
        description: 'Reply detected via Gmail push',
        timestamp: now,
      });
    }
  }
});

/**
 * Proactively refresh tokens nearing expiry
 */
export const refreshGoogleTokens = onSchedule('every 6 hours', async () => {
  const tokens = await db.collection('tokens').get();
  const now = Date.now();
  for (const doc of tokens.docs) {
    const data = doc.data();
    if (data.expiresAt && data.expiresAt > now + 30 * 60 * 1000) continue;
    try {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      );
      oauth2Client.setCredentials({
        refresh_token: decryptToken(data.encryptedRefreshToken),
      });
      const { credentials } = await oauth2Client.refreshAccessToken();
      if (credentials.access_token) {
        await doc.ref.set(
          {
            encryptedAccessToken: encryptToken(credentials.access_token),
            expiresAt: credentials.expiry_date || null,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }
    } catch (err) {
      console.warn('Token refresh failed for', doc.id, err);
      // Mark needs_reauth on user docs if we can find orgId
      if (data.orgId) {
        await db
          .collection('organizations')
          .doc(data.orgId)
          .collection('users')
          .doc(doc.id)
          .set({ inboxStatus: 'needs_reauth', updatedAt: new Date().toISOString() }, { merge: true });
      }
    }
  }
});
