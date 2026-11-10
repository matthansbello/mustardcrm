/**
 * MIME RFC 822 generator for the Gmail API.
 */
import { buildTrackedHtml } from './tracking';

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

/** RFC 2047-encode a header value when it contains non-ASCII characters (e.g. "Zoë"). */
function encodeHeader(value: string): string {
  return /[^\x20-\x7e]/.test(value) ? `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=` : value;
}

/**
 * Creates a raw base64url-encoded RFC 822 message with tracking pixel and wrapped links.
 */
export function createRawMimeEmail(options: ComposeEmailOptions): string {
  const finalHtml = buildTrackedHtml(options);

  const messageParts = [
    `From: ${options.from}`,
    `To: ${options.to}`,
    `Subject: ${encodeHeader(options.subject)}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=utf-8`,
    `X-Mustard-Attempt-Id: ${options.eventId}`,
    ``,
    finalHtml,
  ];

  return Buffer.from(messageParts.join('\r\n'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
