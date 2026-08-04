import { google } from 'googleapis';
import { adminDb } from '@/lib/firebase/admin';
import { decryptToken, encryptToken } from '@/lib/crypto';
import { createRawMimeEmail } from './mime';

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

function personalize(text: string, tokens: Record<string, string>): string {
  return text
    .replace(/\{\{first_name\}\}/gi, tokens.firstName || '')
    .replace(/\{\{company\}\}/gi, tokens.companyName || '')
    .replace(/\{\{title\}\}/gi, tokens.title || '')
    .replace(/\{\{last_name\}\}/gi, tokens.lastName || '');
}

export { personalize };

export async function sendSequenceEmail(
  payload: SendEmailPayload
): Promise<{ success: boolean; messageId?: string; skipped?: boolean }> {
  const {
    orgId,
    userId,
    senderEmail,
    recipientEmail,
    subject,
    bodyHtml,
    sequenceId,
    contactId,
    stepIndex,
    sendAttemptId,
  } = payload;

  const attemptRef = adminDb
    .collection('organizations')
    .doc(orgId)
    .collection('sendAttempts')
    .doc(sendAttemptId);
  const attemptSnap = await attemptRef.get();
  if (attemptSnap.exists) {
    return { success: true, messageId: attemptSnap.data()?.messageId, skipped: true };
  }

  // Claim attempt immediately to prevent double-send races
  await attemptRef.set({
    sendAttemptId,
    sequenceId,
    contactId,
    stepIndex,
    status: 'sending',
    claimedAt: new Date().toISOString(),
  });

  const tokenDoc = await adminDb.collection('tokens').doc(userId).get();
  if (!tokenDoc.exists) {
    await attemptRef.update({ status: 'failed', error: 'token_missing' });
    throw new Error(`Google token for user ${userId} not found`);
  }

  const tokenData = tokenDoc.data()!;
  const decryptedRefreshToken = decryptToken(tokenData.encryptedRefreshToken);

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    await attemptRef.update({ status: 'failed', error: 'oauth_not_configured' });
    throw new Error('Google OAuth credentials not configured');
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: decryptedRefreshToken });

  // Refresh & persist encrypted access token
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

  const eventId = `evt_${sendAttemptId}`;
  const rawMime = createRawMimeEmail({
    from: senderEmail,
    to: recipientEmail,
    subject,
    bodyHtml,
    eventId,
    orgId,
    sequenceId,
    contactId,
  });

  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: rawMime },
  });

  const gmailMessageId = response.data.id || `msg_${Date.now()}`;
  const now = new Date().toISOString();

  await attemptRef.set({
    sendAttemptId,
    sequenceId,
    contactId,
    stepIndex,
    messageId: gmailMessageId,
    status: 'sent',
    sentAt: now,
  });

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
      metadata: {
        messageId: gmailMessageId,
        recipientEmail,
        senderEmail,
        threadId: response.data.threadId || null,
      },
    });

  // Activity timeline
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
      description: `Step ${stepIndex + 1} via ${senderEmail}`,
      timestamp: now,
      actorId: userId,
    });

  return { success: true, messageId: gmailMessageId };
}
