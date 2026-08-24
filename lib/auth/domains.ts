/**
 * Consumer Google accounts (gmail.com, etc.) must not share a single org
 * keyed by domain. Each personal mailbox owner gets their own workspace
 * with full admin access so they can CRM + send cold email.
 */

const CONSUMER_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'google.com', // some consumer test accounts
]);

export function normalizeEmailDomain(email: string): string {
  return (email.split('@')[1] || '').toLowerCase().trim();
}

export function isConsumerGoogleDomain(domain: string): boolean {
  return CONSUMER_EMAIL_DOMAINS.has(domain.toLowerCase());
}

export function isConsumerGoogleEmail(email: string): boolean {
  return isConsumerGoogleDomain(normalizeEmailDomain(email));
}

/**
 * Workspace domains share one org per domain.
 * Gmail.com (and other consumer Google mail) get an isolated personal org.
 */
export function resolveDefaultOrgId(email: string, uid: string): string {
  const domain = normalizeEmailDomain(email) || 'gmail.com';
  if (isConsumerGoogleDomain(domain)) {
    return `org_personal_${uid}`;
  }
  return `org_${domain.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

export function defaultOrgName(email: string, displayName?: string): string {
  const domain = normalizeEmailDomain(email);
  if (isConsumerGoogleDomain(domain)) {
    const label = displayName?.split(' ')[0] || email.split('@')[0] || 'Personal';
    return `${label}'s workspace`;
  }
  const slug = domain.split('.')[0] || 'team';
  return `${slug.charAt(0).toUpperCase()}${slug.slice(1)} Workspace`;
}

/** Conservative Gmail consumer daily cap (Workspace can go higher). */
export function defaultDailyCapForEmail(email: string): number {
  return isConsumerGoogleEmail(email) ? 50 : 80;
}
