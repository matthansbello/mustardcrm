import { google } from 'googleapis';
import { adminDb } from '@/lib/firebase/admin';
import { decryptToken, encryptToken } from '@/lib/crypto';
import { createRawMimeEmail } from './mime';
import { buildTrackedHtml } from './tracking';
import { getMailbox, getZohoAccessToken, markNeedsReauth } from './mailbox';
import { sendZohoMail, ZohoApiError } from './providers/zoho';

export interface SendEmailPayload {
  orgId: string;
  userId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  bodyHtml: string;
  sequenceId: string;
  contactId: string;
  stepIndex: number;
  sendAttemptId: string;
}

export type SendResult =
  | { status: 'sent'; messageId: string }
  /** This step was already delivered by an earlier run — safe to advance the enrollment. */
  | { status: 'already_sent'; messageId?: string }
  /** Another run is sending it right now — leave the enrollment alone. */
  | { status: 'in_flight' };

const IN_FLIGHT_MS = 10 * 60 * 1000;

function personalize(text: string, tokens: Record<string, string>): string {
  return text
    .replace(/\{\{first_name\}\}/gi, tokens.firstName || '')
    .replace(/\{\{company\}\}/gi, tokens.companyName || '')
    .replace(/\{\{title\}\}/gi, tokens.title || '')
    .replace(/\{\{last_name\}\}/gi, tokens.lastName || '');
}

export { personalize };

function isAuthError(err: unknown): boolean {
  if (err instanceof ZohoApiError) return err.needsReauth;
  const message = err instanceof Error ? err.message : String(err);
  return /invalid_grant|unauthorized_client|invalid_token|Token has been expired or revoked/i.test(message);
}

/**
 * Send one sequence step from the sender's connected mailbox (Gmail or Zoho Mail).
 * Idempotent per sendAttemptId: a delivered step is never sent twice, and a failed
 * attempt is released so the next run retries it instead of skipping the email.
 */
export async function sendSequenceEmail(payload: SendEmailPayload): Promise<SendResult> {
  const { orgId, userId, senderEmail, recipientEmail, subject, bodyHtml, sequenceId, contactId, stepIndex, sendAttemptId } =
    payload;

  const attemptRef = adminDb.collection('organizations').doc(orgId).collection('sendAttempts').doc(sendAttemptId);

  // Claim the attempt atomically so two overlapping runs can't both send it.
  const claim = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(attemptRef);
    const existing = snap.data();
    if (existing?.status === 'sent') return { status: 'already_sent' as const, messageId: existing.messageId };
    if (existing?.status === 'sending' && Date.now() - Date.parse(existing.claimedAt || '') < IN_FLIGHT_MS) {
      return { status: 'in_flight' as const };
    }
    tx.set(attemptRef, {
      sendAttemptId,
      sequenceId,
      contactId,
      stepIndex,
      status: 'sending',
      claimedAt: new Date().toISOString(),
      attempts: (existing?.attempts || 0) + 1,
    });
    return null;
  });
  if (claim) return claim;

  let messageId: string;
  let threadId: string | null = null;
  let provider: 'gmail' | 'zoho' = 'gmail';
  let fromAddress = senderEmail;
  const eventId = `evt_${sendAttemptId}`;

  try {
    const mailbox = await getMailbox(userId);
    if (!mailbox) throw new Error(`No sending inbox connected for user ${userId}`);
    provider = mailbox.provider;

    if (mailbox.provider === 'zoho') {
      const { data } = mailbox;
      if (!data.apiBase || !data.zohoAccountId || !data.fromAddress) {
        throw new Error('Zoho mailbox details are incomplete — reconnect Zoho Mail.');
      }
      fromAddress = data.fromAddress;
      const accessToken = await getZohoAccessToken(userId, data);
      const sent = await sendZohoMail({
        apiBase: data.apiBase,
        accessToken,
        accountId: data.zohoAccountId,
        fromAddress: data.fromAddress,
        to: recipientEmail,
        subject,
        html: buildTrackedHtml({ bodyHtml, eventId, orgId, sequenceId, contactId }),
      });
      messageId = sent.messageId;
    } else {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      if (!clientId || !clientSecret) throw new Error('Google OAuth credentials not configured');

      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
      oauth2Client.setCredentials({ refresh_token: decryptToken(mailbox.data.encryptedRefreshToken) });
      const { credentials } = await oauth2Client.refreshAccessToken();
      if (credentials.access_token) {
        await adminDb
          .collection('tokens')
          .doc(userId)
          .set(
            {
              encryptedAccessToken: encryptToken(credentials.access_token),
              expiresAt: credentials.expiry_date || null,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        oauth2Client.setCredentials(credentials);
      }

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: createRawMimeEmail({ from: senderEmail, to: recipientEmail, subject, bodyHtml, eventId, orgId, sequenceId, contactId }),
        },
      });
      messageId = response.data.id || `msg_${Date.now()}`;
      threadId = response.data.threadId || null;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'send_failed';
    // Release the claim so the next run retries this step instead of treating it as sent.
    await attemptRef.set({ status: 'failed', error: message.slice(0, 500), failedAt: new Date().toISOString() }, { merge: true });
    if (isAuthError(err)) await markNeedsReauth(orgId, userId);
    throw err;
  }

  const now = new Date().toISOString();
  await attemptRef.set(
    { sendAttemptId, sequenceId, contactId, stepIndex, messageId, provider, status: 'sent', sentAt: now },
    { merge: true }
  );

  await adminDb
    .collection('organizations')
    .doc(orgId)
    .collection('emailEvents')
    .doc(eventId)
    .set({
      id: eventId,
      orgId,
      sequenceId,
      contactId,
      stepIndex,
      type: 'sent',
      timestamp: now,
      metadata: { messageId, recipientEmail, senderEmail: fromAddress, provider, threadId },
    });

  const activityId = `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
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
      type: 'email_sent',
      title: `Email sent: ${subject}`,
      description: `Step ${stepIndex + 1} via ${fromAddress}`,
      timestamp: now,
      actorId: userId,
    });

  return { status: 'sent', messageId };
}
