/**
 * Adds open/click tracking to an email body (used for every provider).
 * Plain-text bodies are converted to HTML line breaks first.
 */
export interface TrackingOptions {
  bodyHtml: string;
  eventId: string;
  orgId?: string;
  sequenceId?: string;
  contactId?: string;
  baseUrl?: string;
}

/**
 * Turn bare URLs typed into a plain-text step ("See https://acme.io/demo") into links, so they
 * are clickable everywhere and get click tracking. URLs already inside an <a href> are left alone.
 */
export function linkifyPlainText(text: string): string {
  return text.replace(/(^|[\s(])(https?:\/\/[^\s<>"')]+[^\s<>"').,;:!?])/g, (_, lead, url) => `${lead}<a href="${url}">${url}</a>`);
}

export function buildTrackedHtml(options: TrackingOptions): string {
  const { bodyHtml, eventId, orgId, sequenceId, contactId } = options;
  const baseUrl = (options.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');

  const trackingParams = new URLSearchParams({ eventId });
  if (orgId) trackingParams.set('orgId', orgId);
  if (sequenceId) trackingParams.set('sequenceId', sequenceId);
  if (contactId) trackingParams.set('contactId', contactId);

  const pixel = `<img src="${baseUrl}/api/track/open?${trackingParams.toString()}" alt="" width="1" height="1" style="display:none;" />`;

  // Builder bodies are plain text (maybe with an inline <a> link): keep their line breaks and
  // turn bare URLs into links. Only bodies with real layout markup are treated as finished HTML.
  const isLayoutHtml = /<(p|div|br|table|ul|ol|li|h[1-6]|html|body)\b/i.test(bodyHtml);
  const body = isLayoutHtml ? bodyHtml : linkifyPlainText(bodyHtml).replace(/\r?\n/g, '<br/>');

  const html = body.replace(/href="(https?:\/\/[^"]+)"/g, (_, targetUrl) => {
    const clickParams = new URLSearchParams(trackingParams);
    clickParams.set('targetUrl', targetUrl);
    return `href="${baseUrl}/api/track/click?${clickParams.toString()}"`;
  });
  return `${html}\n${pixel}`;
}
