/**
 * MIME RFC 822 Generator for Gmail API
 */

export interface ComposeEmailOptions {
  from: string;
  to: string;
  subject: string;
  bodyHtml: string;
  eventId: string;
  orgId?: string;
  sequenceId?: string;
  contactId?: string;
  baseUrl?: string;
}

/**
 * Creates raw base64url-encoded RFC 822 MIME message with tracking pixel and wrapped links
 */
export function createRawMimeEmail(options: ComposeEmailOptions): string {
  const { from, to, subject, bodyHtml, eventId, orgId, sequenceId, contactId } = options;
  const baseUrl = options.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const trackingParams = new URLSearchParams({ eventId });
  if (orgId) trackingParams.set('orgId', orgId);
  if (sequenceId) trackingParams.set('sequenceId', sequenceId);
  if (contactId) trackingParams.set('contactId', contactId);

  const openPixelUrl = `${baseUrl}/api/track/open?${trackingParams.toString()}`;
  const trackingPixelHtml = `<img src="${openPixelUrl}" alt="" width="1" height="1" style="display:none;" />`;

  const wrappedHtml = bodyHtml.replace(/href="(https?:\/\/[^"]+)"/g, (_, targetUrl) => {
    const clickParams = new URLSearchParams(trackingParams);
    clickParams.set('targetUrl', targetUrl);
    const clickUrl = `${baseUrl}/api/track/click?${clickParams.toString()}`;
    return `href="${clickUrl}"`;
  });

  // Convert plain newlines to <br> if body looks like plain text
  const htmlBody = wrappedHtml.includes('<')
    ? wrappedHtml
    : wrappedHtml.replace(/\n/g, '<br/>');

  const finalHtml = `${htmlBody}\n${trackingPixelHtml}`;

  const messageParts = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=utf-8`,
    `X-Mustard-Attempt-Id: ${eventId}`,
    ``,
    finalHtml,
  ];

  const mimeString = messageParts.join('\r\n');

  return Buffer.from(mimeString)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
