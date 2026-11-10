import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onMessagePublished } from 'firebase-functions/v2/pubsub';
import { google } from 'googleapis';
import * as crypto from 'crypto';
import { findZohoReplySince, refreshZohoAccessToken, sendZohoMail, ZohoApiError } from './zoho';

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

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

interface TrackingOpts {
  bodyHtml: string;
  eventId: string;
  orgId: string;
  sequenceId: string;
  contactId: string;
}

/** Body HTML with open pixel and click-tracked links (used for Gmail and Zoho). */
function buildTrackedHtml(opts: TrackingOpts): string {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const params = new URLSearchParams({
    eventId: opts.eventId,
    orgId: opts.orgId,
    sequenceId: opts.sequenceId,
    contactId: opts.contactId,
  });
  const pixel = `<img src="${baseUrl}/api/track/open?${params}" width="1" height="1" style="display:none" alt="" />`;
  // Plain-text bodies (maybe with an inline <a> link) keep their line breaks.
  const isLayoutHtml = /<(p|div|br|table|ul|ol|li|h[1-6]|html|body)\b/i.test(opts.bodyHtml);
  let html = isLayoutHtml ? opts.bodyHtml : opts.bodyHtml.replace(/\r?\n/g, '<br/>');
  html = html.replace(/href="(https?:\/\/[^"]+)"/g, (_, url) => {
    const p = new URLSearchParams(params);
    p.set('targetUrl', url);
    return `href="${baseUrl}/api/track/click?${p}"`;
  });
  return `${html}\n${pixel}`;
}

function encodeHeader(value: string): string {
  return /[^\x20-\x7e]/.test(value) ? `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=` : value;
}

function createRawMime(opts: TrackingOpts & { from: string; to: string; subject: string }): string {
  const mime = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: ${encodeHeader(opts.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    buildTrackedHtml(opts),
  ].join('\r\n');
  return Buffer.from(mime).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Cached Zoho access token, refreshed shortly before expiry (they last an hour). */
async function getZohoAccessToken(userId: string, token: DocData): Promise<string> {
  if (token.encryptedAccessToken && token.expiresAt && token.expiresAt > Date.now() + 2 * 60 * 1000) {
    return decryptToken(token.encryptedAccessToken);
  }
  const { accessToken, expiresAt } = await refreshZohoAccessToken(token.accountsServer, decryptToken(token.encryptedRefreshToken));
  await db.collection('tokens').doc(userId).set(
    { encryptedAccessToken: encryptToken(accessToken), expiresAt, updatedAt: new Date().toISOString() },
    { merge: true }
  );
  token.encryptedAccessToken = encryptToken(accessToken);
  token.expiresAt = expiresAt;
  return accessToken;
}

const IN_FLIGHT_MS = 10 * 60 * 1000;
const ZOHO_REPLY_CHECK_INTERVAL_MS = 30 * 60 * 1000;

async function bumpStats(
  orgId: string,
  sequenceId: string,
  field: 'sent' | 'opened' | 'clicked' | 'replied' | 'bounced',
  senderUserId?: string
) {
  const seqRef = db.collection('organizations').doc(orgId).collection('sequences').doc(sequenceId);
  await seqRef.update({
    [`stats.${field}`]: FieldValue.increment(1),
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
      [map[field]]: FieldValue.increment(1),
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
          emailsSent: FieldValue.increment(1),
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
          replies: FieldValue.increment(1),
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
        count: FieldValue.increment(1),
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

  // Only a confirmed send counts as sent; a failed attempt is retried, and a fresh claim
  // stops two overlapping runs from sending the same step.
  const claim = await db.runTransaction(async (tx) => {
    const existing = (await tx.get(attemptRef)).data();
    if (existing?.status === 'sent') return 'already_sent';
    if (existing?.status === 'sending' && Date.now() - Date.parse(existing.claimedAt || '') < IN_FLIGHT_MS) {
      return 'in_flight';
    }
    tx.set(attemptRef, {
      sendAttemptId,
      status: 'sending',
      claimedAt: new Date().toISOString(),
      attempts: (existing?.attempts || 0) + 1,
    });
    return 'claimed';
  });
  if (claim === 'in_flight') return false;
  if (claim === 'already_sent') {
    await advanceEnrollment(orgId, sequenceId, enrollmentId, enrollment, step, sendAttemptId, undefined, senderUserId);
    return true;
  }

  try {
    const tokenDoc = await db.collection('tokens').doc(senderUserId).get();
    if (!tokenDoc.exists) throw new Error('token_missing');
    const token = tokenDoc.data()!;
    const subject = personalize(step.subject, contact);
    const body = personalize(step.body, contact);
    const eventId = `evt_${sendAttemptId}`;
    const tracking = { bodyHtml: body, eventId, orgId, sequenceId, contactId: contact.id };

    let messageId = '';
    let threadId: string | null = null;
    let fromAddress: string = sender.sendingEmail || sender.email;

    if (token.provider === 'zoho') {
      if (!token.apiBase || !token.zohoAccountId || !token.fromAddress) throw new Error('zoho_mailbox_incomplete');
      fromAddress = token.fromAddress;
      messageId = await sendZohoMail({
        apiBase: token.apiBase,
        accessToken: await getZohoAccessToken(senderUserId, token),
        accountId: token.zohoAccountId,
        fromAddress: token.fromAddress,
        to: contact.email,
        subject,
        html: buildTrackedHtml(tracking),
      });
    } else {
      const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
      oauth2Client.setCredentials({ refresh_token: decryptToken(token.encryptedRefreshToken) });
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
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: createRawMime({ ...tracking, from: fromAddress, to: contact.email, subject }) },
      });
      messageId = response.data.id || '';
      threadId = response.data.threadId || null;
    }

    const now = new Date().toISOString();

    await attemptRef.set({
      sendAttemptId,
      status: 'sent',
      messageId,
      provider: token.provider === 'zoho' ? 'zoho' : 'gmail',
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
          threadId,
          provider: token.provider === 'zoho' ? 'zoho' : 'gmail',
          senderEmail: fromAddress,
          recipientEmail: contact.email,
        },
      });

    await incrementDailySendCount(orgId, senderUserId);
    await bumpStats(orgId, sequenceId, 'sent', senderUserId);
    await advanceEnrollment(orgId, sequenceId, enrollmentId, enrollment, step, sendAttemptId, messageId, senderUserId);

    // Leads become "contacted" — never downgrade a contact who is already further along.
    if (!contact.lifecycleStage || contact.lifecycleStage === 'lead') {
      await contactSnap.ref.set({ lifecycleStage: 'contacted', updatedAt: now }, { merge: true });
    }

    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'send_failed';
    await attemptRef.set({ status: 'failed', error: message.slice(0, 500), failedAt: new Date().toISOString() }, { merge: true });
    if (
      (err instanceof ZohoApiError && err.needsReauth) ||
      message.includes('invalid_grant') ||
      message.includes('token')
    ) {
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
  messageId?: string,
  senderUserId?: string
) {
  const now = new Date();
  const history = [
    ...(enrollment.history || []),
    {
      stepIndex: enrollment.currentStepIndex || 0,
      sentAt: now.toISOString(),
      messageId: messageId || null,
      sendAttemptId,
      senderUserId: senderUserId || null,
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

/** Record a reply: stop the enrollment, count it, move contact + deals to "replied", log activity. */
async function recordReply(p: {
  orgId: string;
  sequenceId: string;
  contactId: string;
  senderUserId?: string;
  replyId: string;
  source: string;
}) {
  const org = db.collection('organizations').doc(p.orgId);
  const now = new Date().toISOString();
  await org.collection('sequences').doc(p.sequenceId).collection('enrollments').doc(p.contactId).set(
    { status: 'replied', nextSendDueAt: null, repliedAt: now, updatedAt: now },
    { merge: true }
  );
  await bumpStats(p.orgId, p.sequenceId, 'replied', p.senderUserId);
  await org.collection('emailEvents').doc(`reply_${p.replyId}`).set({
    id: `reply_${p.replyId}`,
    orgId: p.orgId,
    sequenceId: p.sequenceId,
    contactId: p.contactId,
    type: 'reply',
    timestamp: now,
    metadata: { replyId: p.replyId, source: p.source },
  });
  const contactRef = org.collection('contacts').doc(p.contactId);
  await contactRef.set({ lifecycleStage: 'replied', updatedAt: now }, { merge: true });
  const deals = await org.collection('deals').where('contactId', '==', p.contactId).get();
  for (const d of deals.docs) await d.ref.update({ stage: 'replied', updatedAt: now });
  await contactRef.collection('activity').doc(`act_reply_${p.replyId}`).set({
    id: `act_reply_${p.replyId}`,
    contactId: p.contactId,
    type: 'email_replied',
    title: 'Prospect replied',
    description: `Reply detected via ${p.source}`,
    timestamp: now,
  });
}

/**
 * Zoho has no push notifications, so check a Zoho sender's mailbox for a reply from this
 * contact since the last send. Returns true when a reply was found and recorded.
 */
async function checkZohoReply(
  orgId: string,
  sequenceId: string,
  enrDoc: FirebaseFirestore.QueryDocumentSnapshot,
  senderUserId: string,
  token: DocData,
  due: boolean
): Promise<boolean> {
  const enrollment = enrDoc.data();
  const lastSentAt: string | undefined = enrollment.history?.[enrollment.history.length - 1]?.sentAt;
  if (!lastSentAt || !token.apiBase || !token.zohoAccountId) return false;
  const lastCheck = Date.parse(enrollment.lastReplyCheckAt || '') || 0;
  if (!due && Date.now() - lastCheck < ZOHO_REPLY_CHECK_INTERVAL_MS) return false;

  try {
    const contact = await db.collection('organizations').doc(orgId).collection('contacts').doc(enrollment.contactId).get();
    if (!contact.exists) return false;
    const reply = await findZohoReplySince({
      apiBase: token.apiBase,
      accessToken: await getZohoAccessToken(senderUserId, token),
      accountId: token.zohoAccountId,
      fromEmail: String(contact.get('email') || ''),
      sinceMs: Date.parse(lastSentAt),
    });
    await enrDoc.ref.set({ lastReplyCheckAt: new Date().toISOString() }, { merge: true });
    if (!reply) return false;
    await recordReply({
      orgId,
      sequenceId,
      contactId: enrollment.contactId,
      senderUserId,
      replyId: `zoho_${reply.messageId}`,
      source: 'Zoho Mail',
    });
    return true;
  } catch (err) {
    if (err instanceof ZohoApiError && err.needsReauth) {
      await db.collection('organizations').doc(orgId).collection('users').doc(senderUserId).set(
        { inboxStatus: 'needs_reauth', updatedAt: new Date().toISOString() },
        { merge: true }
      );
    }
    console.warn('Zoho reply check failed:', err instanceof Error ? err.message : err);
    return false;
  }
}

async function runSequenceTick(): Promise<{ processed: number }> {
  const orgs = await db.collection('organizations').get();
  let processed = 0;
  const nowIso = new Date().toISOString();
  const tokenCache = new Map<string, DocData | null>();

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
        const due = Boolean(enrollment.nextSendDueAt && enrollment.nextSendDueAt <= nowIso);

        // Zoho reply detection for the mailbox that sent the last step.
        const lastSender: string | undefined =
          enrollment.history?.[enrollment.history.length - 1]?.senderUserId || sequence.settings?.senderUserIds?.[0];
        if (lastSender && enrollment.history?.length) {
          if (!tokenCache.has(lastSender)) {
            const t = await db.collection('tokens').doc(lastSender).get();
            tokenCache.set(lastSender, t.exists ? t.data()! : null);
          }
          const token = tokenCache.get(lastSender);
          if (token?.provider === 'zoho' && (await checkZohoReply(orgId, seqDoc.id, enrDoc, lastSender, token, due))) {
            continue;
          }
        }

        if (!due) continue;

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

    // The web app imports rows itself and records the job as "completed";
    // only process jobs explicitly queued for the server with an uploaded file.
    if (job.status !== 'pending' || !job.storagePath) return;

    await jobRef.update({ status: 'validating', updatedAt: new Date().toISOString() });

    try {
      const bucket = getStorage().bucket();
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
    if (data.provider === 'zoho') continue; // Zoho access tokens are refreshed on demand when sending
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
