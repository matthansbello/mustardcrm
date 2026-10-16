/**
 * Mustard runs as a single shared workspace: every user — whatever sign-in
 * method or email domain they use — joins the same organization, so all
 * contacts, companies, deals and sequences are visible to everyone.
 */

export const SHARED_ORG_ID = process.env.MUSTARD_WORKSPACE_ID || 'org_mustard';

export const SHARED_ORG_NAME = process.env.MUSTARD_WORKSPACE_NAME || 'Mustard Workspace';

const CONSUMER_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'google.com', // some consumer test accounts
]);

export function normalizeEmailDomain(email: string): string {
  return (email.split('@')[1] || '').toLowerCase().trim();
}

export function isConsumerGoogleEmail(email: string): boolean {
  return CONSUMER_EMAIL_DOMAINS.has(normalizeEmailDomain(email));
}

/** Conservative Gmail consumer daily cap (Workspace can go higher). */
export function defaultDailyCapForEmail(email: string): number {
  return isConsumerGoogleEmail(email) ? 50 : 80;
}
