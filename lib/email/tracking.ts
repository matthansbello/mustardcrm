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

export function buildTrackedHtml(options: TrackingOptions): string {
  const { bodyHtml, eventId, orgId, sequenceId, contactId } = options;
  const baseUrl = (options.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');

  const trackingParams = new URLSearchParams({ eventId });
  if (orgId) trackingParams.set('orgId', orgId);
  if (sequenceId) trackingParams.set('sequenceId', sequenceId);
  if (contactId) trackingParams.set('contactId', contactId);

  const pixel = `<img src="${baseUrl}/api/track/open?${trackingParams.toString()}" alt="" width="1" height="1" style="display:none;" />`;

  const wrapped = bodyHtml.replace(/href="(https?:\/\/[^"]+)"/g, (_, targetUrl) => {
    const clickParams = new URLSearchParams(trackingParams);
    clickParams.set('targetUrl', targetUrl);
    return `href="${baseUrl}/api/track/click?${clickParams.toString()}"`;
  });

  // Builder bodies are plain text (maybe with an inline <a> link): keep their line breaks.
  // Only bodies with real layout markup are treated as finished HTML.
  const isLayoutHtml = /<(p|div|br|table|ul|ol|li|h[1-6]|html|body)\b/i.test(wrapped);
  const html = isLayoutHtml ? wrapped : wrapped.replace(/\r?\n/g, '<br/>');
  return `${html}\n${pixel}`;
}
