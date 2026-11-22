import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onMessagePublished } from 'firebase-functions/v2/pubsub';
import { google } from 'googleapis';
import * as crypto from 'crypto';
import { listZohoMessagesSince, refreshZohoAccessToken, sendZohoMail, ZohoApiError } from './zoho';

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

/**
 * Turn bare URLs typed into a plain-text step ("See https://acme.io/demo") into links, so they
 * are clickable everywhere and get click tracking. URLs already inside an <a href> are left alone.
 */
function linkifyPlainText(text: string): string {
  return text.replace(/(^|[\s(])(https?:\/\/[^\s<>"')]+[^\s<>"').,;:!?])/g, (_, lead, url) => `${lead}<a href="${url}">${url}</a>`);
}

/** Body HTML with open pixel and click-tracked links (used for Gmail and Zoho). */
function buildTrackedHtml(opts: TrackingOpts): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  // Without it every tracked link would point at localhost — refuse rather than send broken emails.
  if (!configured && process.env.K_SERVICE && !process.env.FUNCTIONS_EMULATOR) {
    throw new Error('NEXT_PUBLIC_APP_URL (or APP_URL) must be set for the sending service');
  }
  const baseUrl = (configured || 'http://localhost:3000').replace(/\/+$/, '');
  const params = new URLSearchParams({
    eventId: opts.eventId,
    orgId: opts.orgId,
    sequenceId: opts.sequenceId,
    contactId: opts.contactId,
  });
  const pixel = `<img src="${baseUrl}/api/track/open?${params}" width="1" height="1" style="display:none" alt="" />`;
  // Plain-text bodies (maybe with an inline <a> link) keep their line breaks.
  const isLayoutHtml = /<(p|div|br|table|ul|ol|li|h[1-6]|html|body)\b/i.test(opts.bodyHtml);
  let html = isLayoutHtml ? opts.bodyHtml : linkifyPlainText(opts.bodyHtml).replace(/\r?\n/g, '<br/>');
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

type SendResult =
  | { kind: 'sent' }
  | { kind: 'skipped' | 'already_sent' | 'in_flight' }
  | { kind: 'failed'; scope: 'sender' | 'recipient'; message: string };

/** After this many failures for one recipient (bad address etc.) the enrollment stops. */
const MAX_RECIPIENT_FAILURES = 3;

function errorStatus(err: unknown): number | undefined {
  const e = err as { status?: unknown; code?: unknown; response?: { status?: unknown } };
  const s = Number(e?.response?.status ?? e?.status ?? e?.code);
  return Number.isFinite(s) && s >= 100 && s < 600 ? s : undefined;
}

/**
 * Is this a problem with the sending mailbox or the server set-up (stop using this sender
 * for the rest of the run) rather than with this one recipient?
 */
function isSenderLevelError(err: unknown, message: string): boolean {
  if (err instanceof ZohoApiError && err.needsReauth) return true;
  const status = errorStatus(err);
  if (status && (status === 401 || status === 403 || status === 429 || status >= 500)) return true;
  return /TOKEN_ENCRYPTION_KEY|APP_URL|token_missing|zoho_mailbox_incomplete|invalid_grant|invalid_client|unauthorized_client|Untrusted Zoho|quota|rate ?limit|limit exceeded|sending limit/i.test(
    message
  );
}

/** Only genuine authorisation failures ask the user to reconnect their inbox. */
function needsReconnect(err: unknown, message: string): boolean {
  return (err instanceof ZohoApiError && err.needsReauth) || /invalid_grant|token_missing/i.test(message);
}

/** Send the current step of one enrollment from a sender already checked to be ready. */
async function sendOneEnrollment(params: {
  orgId: string;
  sequenceId: string;
  sequence: DocData;
  enrDoc: FirebaseFirestore.QueryDocumentSnapshot;
  senderUserId: string;
  sender: DocData;
  token: DocData;
}): Promise<SendResult> {
  const { orgId, sequenceId, sequence, enrDoc, senderUserId, sender, token } = params;
  const enrollment = enrDoc.data();
  const org = db.collection('organizations').doc(orgId);
  const stepIndex = enrollment.currentStepIndex || 0;
  const step = sequence.steps?.[stepIndex];
  const stamp = () => new Date().toISOString();

  if (!step) {
    await enrDoc.ref.update({ status: 'completed', nextSendDueAt: null, updatedAt: stamp() });
    return { kind: 'skipped' };
  }

  const contactSnap = await org.collection('contacts').doc(enrollment.contactId).get();
  if (!contactSnap.exists || !contactSnap.get('email')) {
    await enrDoc.ref.update({ status: 'error', nextSendDueAt: null, lastError: 'contact_missing', updatedAt: stamp() });
    return { kind: 'skipped' };
  }
  const contact: DocData = { ...contactSnap.data()!, id: contactSnap.id };
  // People who unsubscribed or bounced after being enrolled are never emailed again.
  if (contact.lifecycleStage === 'unsubscribed' || contact.lifecycleStage === 'bounced') {
    await enrDoc.ref.update({ status: contact.lifecycleStage, nextSendDueAt: null, updatedAt: stamp() });
    return { kind: 'skipped' };
  }

  const sendAttemptId = `${sequenceId}_${enrollment.contactId}_${stepIndex}`;
  const attemptRef = org.collection('sendAttempts').doc(sendAttemptId);

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
      claimedAt: stamp(),
      attempts: (existing?.attempts || 0) + 1,
    });
    return 'claimed';
  });
  if (claim === 'in_flight') return { kind: 'in_flight' };
  if (claim === 'already_sent') {
    await advanceEnrollment(orgId, sequenceId, enrDoc.id, enrollment, step, sendAttemptId, undefined, senderUserId);
    return { kind: 'already_sent' };
  }

  try {
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
    await advanceEnrollment(orgId, sequenceId, enrDoc.id, enrollment, step, sendAttemptId, messageId, senderUserId);

    // Leads become "contacted" — never downgrade a contact who is already further along.
    if (!contact.lifecycleStage || contact.lifecycleStage === 'lead') {
      await contactSnap.ref.set({ lifecycleStage: 'contacted', updatedAt: now }, { merge: true });
    }

    return { kind: 'sent' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'send_failed';
    await attemptRef.set({ status: 'failed', error: message.slice(0, 500), failedAt: stamp() }, { merge: true });

    if (isSenderLevelError(err, message)) {
      if (needsReconnect(err, message)) {
        await org.collection('users').doc(senderUserId).set({ inboxStatus: 'needs_reauth', updatedAt: stamp() }, { merge: true });
      }
      console.error(`Sender ${senderUserId} paused for this run:`, message);
      return { kind: 'failed', scope: 'sender', message };
    }

    // A problem with this recipient: retry later with back-off, then give up on them.
    const failures = (enrollment.sendFailures || 0) + 1;
    await enrDoc.ref.update(
      failures >= MAX_RECIPIENT_FAILURES
        ? { status: 'error', nextSendDueAt: null, sendFailures: failures, lastError: message.slice(0, 300), updatedAt: stamp() }
        : {
            sendFailures: failures,
            lastError: message.slice(0, 300),
            nextSendDueAt: new Date(Date.now() + failures * 60 * 60 * 1000).toISOString(),
            updatedAt: stamp(),
          }
    );
    console.warn(`Send to contact ${enrollment.contactId} failed (${failures}/${MAX_RECIPIENT_FAILURES}):`, message);
    return { kind: 'failed', scope: 'recipient', message };
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
      // Due follow-ups are sent before first emails to new contacts (see sendDueForSequence).
      followUp: true,
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
 * Zoho has no push notifications, so scan the sender's mailbox once per run for anything
 * received since the last scan, and record a reply for each enrolled contact who wrote back.
 * Returns the number of replies recorded.
 */
async function scanZohoReplies(
  orgId: string,
  senderUserId: string,
  token: DocData,
  sequences: FirebaseFirestore.QueryDocumentSnapshot[]
): Promise<number> {
  if (!token.apiBase || !token.zohoAccountId) return 0;
  const org = db.collection('organizations').doc(orgId);
  const stateRef = org.collection('mailboxState').doc(senderUserId);
  const scanStartedAt = Date.now();
  const lastScan = Date.parse((await stateRef.get()).get('lastScanAt') || '');
  const earliestLaunch = Math.min(...sequences.map((s) => Date.parse(s.get('createdAt') || '') || scanStartedAt));
  // Overlap the previous scan a little; never look back more than two weeks.
  const sinceMs = Math.max(Number.isFinite(lastScan) ? lastScan - 10 * 60 * 1000 : earliestLaunch, scanStartedAt - 14 * 86400000);

  try {
    const messages = await listZohoMessagesSince({
      apiBase: token.apiBase,
      accessToken: await getZohoAccessToken(senderUserId, token),
      accountId: token.zohoAccountId,
      sinceMs,
    });
    const own = String(token.fromAddress || '').toLowerCase();
    const newestByAddress = new Map<string, { messageId: string; receivedMs: number }>();
    for (const m of messages) {
      if (m.fromAddress === own) continue;
      const prev = newestByAddress.get(m.fromAddress);
      if (!prev || m.receivedMs > prev.receivedMs) newestByAddress.set(m.fromAddress, m);
    }

    let found = 0;
    const addresses = [...newestByAddress.keys()].slice(0, 600);
    for (let i = 0; i < addresses.length; i += 30) {
      const contacts = await org.collection('contacts').where('email', 'in', addresses.slice(i, i + 30)).get();
      for (const c of contacts.docs) {
        const msg = newestByAddress.get(String(c.get('email')).toLowerCase());
        if (!msg) continue;
        for (const seq of sequences) {
          const enr = await seq.ref.collection('enrollments').doc(c.id).get();
          const e = enr.data();
          if (!e || e.status !== 'active' || !e.history?.length) continue;
          // Anything from them after we first emailed them counts as a reply.
          if (msg.receivedMs <= Date.parse(e.history[0].sentAt)) continue;
          await recordReply({
            orgId,
            sequenceId: seq.id,
            contactId: c.id,
            senderUserId,
            replyId: `zoho_${msg.messageId}`,
            source: 'Zoho Mail',
          });
          found++;
        }
      }
    }
    await stateRef.set(
      { lastScanAt: new Date(scanStartedAt).toISOString(), lastScanMessages: messages.length, updatedAt: new Date().toISOString() },
      { merge: true }
    );
    return found;
  } catch (err) {
    if (err instanceof ZohoApiError && err.needsReauth) {
      await org.collection('users').doc(senderUserId).set({ inboxStatus: 'needs_reauth', updatedAt: new Date().toISOString() }, { merge: true });
    }
    console.warn('Zoho reply scan failed:', err instanceof Error ? err.message : err);
    return 0;
  }
}

// ---------- Send engine ----------

const TICK_MINUTES = 5;
/** Hard ceiling per sender per run, whatever the daily limit. */
const MAX_SENDS_PER_RUN = 25;
const DUE_PAGE_SIZE = 100;

type SendingWindow = { startHour: number; endHour: number; timezone: string };

/** Minutes left today in the sending window (or until the UTC day — and the daily count — resets). */
function minutesLeftToday(window?: SendingWindow): number {
  const now = new Date();
  if (!window) return 24 * 60 - (now.getUTCHours() * 60 + now.getUTCMinutes());
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: window.timezone || 'UTC', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
    const h = Number(parts.find((p) => p.type === 'hour')?.value);
    const m = Number(parts.find((p) => p.type === 'minute')?.value);
    return window.endHour * 60 - (h * 60 + m);
  } catch {
    return window.endHour * 60 - (now.getUTCHours() * 60 + now.getUTCMinutes());
  }
}

/**
 * How many emails this sender may send in this run: what's left of the daily limit, spread
 * evenly over the runs left in today's window (a steady trickle, not a burst at opening time).
 */
function runQuota(remainingToday: number, window?: SendingWindow): number {
  const runsLeft = Math.max(1, Math.floor(minutesLeftToday(window) / TICK_MINUTES));
  return Math.min(MAX_SENDS_PER_RUN, Math.ceil(remainingToday / runsLeft));
}

interface TickContext {
  /** Senders that hit a mailbox/server problem this run, with the reason. */
  blocked: Map<string, string>;
  senders: Map<string, { sender: DocData; token: DocData } | { problem: string }>;
}

/** Explain a sender problem in words an admin can act on. */
function describeSenderProblem(message: string): string {
  if (/TOKEN_ENCRYPTION_KEY/.test(message)) return 'The sending service is missing TOKEN_ENCRYPTION_KEY, so it can’t unlock the connected inbox.';
  if (/APP_URL/.test(message)) return 'The sending service is missing NEXT_PUBLIC_APP_URL, so tracking links can’t be built.';
  if (/invalid_client|ZOHO_CLIENT|GOOGLE_CLIENT/i.test(message)) return 'The sending service’s Zoho/Google OAuth client settings are missing or wrong.';
  if (/invalid_grant|token_missing|needs reconnect|INVALID_OAUTHTOKEN/i.test(message)) return 'The sending inbox needs to be reconnected.';
  if (/quota|rate ?limit|limit exceeded|sending limit/i.test(message)) return 'The mail provider is rate-limiting this inbox; sending resumes automatically.';
  return `Sending is failing: ${message.slice(0, 200)}`;
}

async function loadSender(orgId: string, uid: string, ctx: TickContext) {
  if (!ctx.senders.has(uid)) {
    const [userSnap, tokenSnap] = await Promise.all([
      db.collection('organizations').doc(orgId).collection('users').doc(uid).get(),
      db.collection('tokens').doc(uid).get(),
    ]);
    const status = userSnap.get('inboxStatus');
    ctx.senders.set(
      uid,
      !userSnap.exists
        ? { problem: 'The sender of this sequence is no longer in the workspace.' }
        : status !== 'connected' || !tokenSnap.exists
          ? { problem: status === 'needs_reauth' ? 'The sending inbox needs to be reconnected (Settings → Sending inbox).' : 'The sender has no inbox connected.' }
          : { sender: userSnap.data()!, token: tokenSnap.data()! }
    );
  }
  return ctx.senders.get(uid)!;
}

/** Record how delivery is going on the sequence, so problems show up in the app. */
async function setDeliveryStatus(seqDoc: FirebaseFirestore.QueryDocumentSnapshot, status: { state: 'ok' | 'error'; message: string | null }, sent: number) {
  const prev = seqDoc.get('deliveryStatus') || {};
  if (!sent && prev.state === status.state && prev.message === status.message) return;
  const now = new Date().toISOString();
  await seqDoc.ref.set(
    { deliveryStatus: { ...prev, ...status, checkedAt: now, ...(sent ? { lastSentAt: now } : {}) } },
    { merge: true }
  );
}

/** Send what's due for one sequence, within its window, daily limit and per-run pace. */
async function sendDueForSequence(orgId: string, seqDoc: FirebaseFirestore.QueryDocumentSnapshot, ctx: TickContext): Promise<number> {
  const sequence = seqDoc.data();
  const senderIds: string[] = sequence.settings?.senderUserIds || [];
  const window: SendingWindow | undefined = sequence.settings?.sendingWindow;
  if (!senderIds.length) {
    await setDeliveryStatus(seqDoc, { state: 'error', message: 'No sending inbox is set for this sequence.' }, 0);
    return 0;
  }
  if (window && !isWithinSendingWindow(window)) return 0;

  const cap = sequence.settings?.dailyCapPerMailbox || 50;
  const budgets = new Map<string, number>();
  const ready = new Map<string, { sender: DocData; token: DocData }>();
  const problems: string[] = [];
  for (const uid of senderIds) {
    if (ctx.blocked.has(uid)) {
      problems.push(ctx.blocked.get(uid)!);
      continue;
    }
    const info = await loadSender(orgId, uid, ctx);
    if ('problem' in info) {
      problems.push(info.problem);
      continue;
    }
    const remaining = cap - (await getDailySendCount(orgId, uid));
    if (remaining <= 0) continue;
    budgets.set(uid, runQuota(remaining, window));
    ready.set(uid, info);
  }
  if (!budgets.size) {
    if (problems.length) await setDeliveryStatus(seqDoc, { state: 'error', message: problems[0] }, 0);
    return 0;
  }

  const nowIso = new Date().toISOString();
  let sent = 0;
  const enrollmentsRef = seqDoc.ref.collection('enrollments');

  /** Send through a due-ordered query until the run's budget is used up. */
  const drain = async (base: FirebaseFirestore.Query) => {
    let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    for (;;) {
      const page: FirebaseFirestore.QuerySnapshot = await (cursor ? base.startAfter(cursor) : base).limit(DUE_PAGE_SIZE).get();
      for (const enrDoc of page.docs) {
        if (enrDoc.get('status') !== 'active') continue;
        // The sender with the most room left this run.
        const uid = [...budgets.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        if (!uid) return;
        const { sender, token } = ready.get(uid)!;
        const result = await sendOneEnrollment({ orgId, sequenceId: seqDoc.id, sequence, enrDoc, senderUserId: uid, sender, token });
        if (result.kind === 'sent') {
          sent++;
          const left = budgets.get(uid)! - 1;
          if (left > 0) budgets.set(uid, left);
          else budgets.delete(uid);
        } else if (result.kind === 'failed' && result.scope === 'sender') {
          const reason = describeSenderProblem(result.message);
          ctx.blocked.set(uid, reason);
          problems.push(reason);
          budgets.delete(uid);
        }
      }
      if (page.size < DUE_PAGE_SIZE || !budgets.size) return;
      cursor = page.docs[page.docs.length - 1];
    }
  };

  // 1. Follow-ups that are due go first, so people get step 2 on time even while thousands
  //    of first emails are still queued. (Uses the followUp + nextSendDueAt index.)
  try {
    await drain(enrollmentsRef.where('followUp', '==', true).where('nextSendDueAt', '<=', nowIso).orderBy('nextSendDueAt'));
  } catch (err) {
    console.warn('Follow-up query failed (is the Firestore index deployed?):', err instanceof Error ? err.message : err);
  }
  // 2. Then everything else that's due, oldest first.
  if (budgets.size) await drain(enrollmentsRef.where('nextSendDueAt', '<=', nowIso).orderBy('nextSendDueAt'));

  await setDeliveryStatus(seqDoc, sent || !problems.length ? { state: 'ok', message: null } : { state: 'error', message: problems[0] }, sent);
  return sent;
}

async function runSequenceTick(): Promise<{ processed: number; replies: number }> {
  const orgs = await db.collection('organizations').get();
  let processed = 0;
  let replies = 0;

  for (const orgDoc of orgs.docs) {
    const ctx: TickContext = { blocked: new Map(), senders: new Map() };
    const sequences = await orgDoc.ref.collection('sequences').where('status', '==', 'active').get();

    // Zoho reply detection first (one mailbox scan per Zoho sender), so nobody who
    // replied gets the next follow-up.
    const bySender = new Map<string, FirebaseFirestore.QueryDocumentSnapshot[]>();
    for (const seq of sequences.docs) {
      for (const uid of (seq.get('settings.senderUserIds') as string[] | undefined) || []) {
        bySender.set(uid, [...(bySender.get(uid) || []), seq]);
      }
    }
    for (const [uid, seqs] of bySender) {
      const info = await loadSender(orgDoc.id, uid, ctx);
      if ('token' in info && info.token.provider === 'zoho') replies += await scanZohoReplies(orgDoc.id, uid, info.token, seqs);
    }

    for (const seq of sequences.docs) {
      try {
        processed += await sendDueForSequence(orgDoc.id, seq, ctx);
      } catch (err) {
        console.error(`Sequence ${seq.id} tick failed:`, err instanceof Error ? err.message : err);
      }
    }
  }

  return { processed, replies };
}

/**
 * Scheduled sequence tick — every 5 minutes
 */
export const onSequenceTick = onSchedule(
  { schedule: 'every 5 minutes', timeoutSeconds: 540, memory: '512MiB' },
  async () => {
    const result = await runSequenceTick();
    console.log('onSequenceTick sent', result.processed, 'replies', result.replies);
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

  // Only forward to ordinary web links (never javascript:, data: or other schemes).
  let destination = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '/').replace(/\/+$/, '') || '/';
  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') destination = parsed.toString();
  } catch {
    // malformed target — fall back to the app
  }
  res.redirect(302, destination);
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
