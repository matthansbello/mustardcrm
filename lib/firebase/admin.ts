import { cert, getApps, initializeApp, type ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

/**
 * Firebase Admin credentials, in order of preference:
 *  1. FIREBASE_SERVICE_ACCOUNT — the whole service-account JSON file pasted as one value
 *     (least error-prone on Netlify: no newline escaping to get wrong).
 *  2. FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.
 * With neither (and no emulator), server routes that touch Firestore will fail.
 */

const clean = (v?: string) => (v || '').trim().replace(/^["']|["']$/g, '');

/**
 * Rebuild a PEM private key from however it survived being pasted into a hosting
 * dashboard: literal or double-escaped "\\n", spaces instead of line breaks, Windows
 * line endings, surrounding quotes, missing trailing newline. The Admin SDK's parser
 * (OpenSSL) rejects all of those, which would otherwise take down every server route.
 */
export function normalizePrivateKey(raw: string): string {
  // One or more backslashes before "n" is an escaped line break, however many times it was escaped.
  const key = clean(raw).replace(/\\+n/g, '\n').replace(/\r/g, '');
  const match = key.match(/-----BEGIN ([A-Z ]+)-----([\s\S]*?)-----END \1-----/);
  if (!match) return key;
  const [, label, body] = match;
  const base64 = body.replace(/[^A-Za-z0-9+/=]/g, '');
  const lines = base64.match(/.{1,64}/g) || [];
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----\n`;
}

const projectId =
  clean(process.env.FIREBASE_PROJECT_ID) || clean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) || 'demo-project';

/**
 * Which credential source was used, which env vars were missing, and why the key was
 * rejected at startup (if it was) — names and library messages only, never values.
 */
export const adminCredentialInfo: { source: string; missing: string[]; initError: string | null } = {
  source: 'none',
  missing: [],
  initError: null,
};

function loadServiceAccount(): ServiceAccount | null {
  const json = clean(process.env.FIREBASE_SERVICE_ACCOUNT);
  if (json) {
    try {
      const parsed = JSON.parse(json);
      adminCredentialInfo.source = 'FIREBASE_SERVICE_ACCOUNT';
      return {
        projectId: parsed.project_id || projectId,
        clientEmail: parsed.client_email,
        privateKey: normalizePrivateKey(String(parsed.private_key || '')),
      };
    } catch {
      console.error('[firebase-admin] FIREBASE_SERVICE_ACCOUNT is not valid JSON — paste the whole key file contents.');
      adminCredentialInfo.missing.push('FIREBASE_SERVICE_ACCOUNT (not valid JSON)');
    }
  }

  const clientEmail = clean(process.env.FIREBASE_CLIENT_EMAIL);
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY || '');
  if (clientEmail && privateKey) {
    adminCredentialInfo.source = 'FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY';
    return { projectId, clientEmail, privateKey };
  }
  if (!json) {
    if (!clientEmail) adminCredentialInfo.missing.push('FIREBASE_CLIENT_EMAIL');
    if (!privateKey) adminCredentialInfo.missing.push('FIREBASE_PRIVATE_KEY');
  }
  return null;
}

const usingEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST);

if (!getApps().length) {
  const account = loadServiceAccount();

  if (account) {
    const accountProject = account.clientEmail?.split('@')[1]?.split('.')[0];
    if (accountProject && accountProject !== projectId && !usingEmulator) {
      console.error(
        `[firebase-admin] Service account ${account.clientEmail} belongs to project "${accountProject}" but the app uses "${projectId}". ` +
          'Generate a key for the right project (Firebase console → Project settings → Service accounts).'
      );
    }
    // cert() throws synchronously on a malformed key (bad PEM, literal "\n", missing
    // client_email). Throwing here would crash this module on import, turning every API
    // route into an empty 500 — so record the reason and start without credentials;
    // requests then fail with a clear message from describeAdminCredentialError().
    let credential: ReturnType<typeof cert> | undefined;
    try {
      credential = cert(account);
    } catch (err) {
      adminCredentialInfo.initError = err instanceof Error ? err.message : String(err);
      console.error(
        `[firebase-admin] The service-account key from ${adminCredentialInfo.source} was rejected: ${adminCredentialInfo.initError} ` +
          'Re-copy the key from the Firebase console (Project settings → Service accounts → Generate new private key).'
      );
    }
    initializeApp({
      ...(credential ? { credential } : {}),
      projectId,
      storageBucket: clean(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) || undefined,
    });
  } else {
    if (!usingEmulator) {
      console.error(
        `[firebase-admin] No service-account credentials at runtime (missing: ${adminCredentialInfo.missing.join(', ') || 'none'}). ` +
          'Set FIREBASE_SERVICE_ACCOUNT, or FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY, with the "Functions" scope on Netlify — ' +
          'sign-in and other server features will fail.'
      );
    }
    initializeApp({ projectId });
  }
}

export const adminDb = getFirestore();
export const adminAuth = getAuth();
export const adminStorage = getStorage();

/**
 * Turn Admin SDK credential failures (gRPC 16 UNAUTHENTICATED, invalid_grant, missing
 * default credentials, 7 PERMISSION_DENIED) into a message that says what to fix.
 * Returns null for unrelated errors.
 */
export function describeAdminCredentialError(err: unknown): string | null {
  const message = err instanceof Error ? err.message : String(err);
  const code = (err as { code?: unknown })?.code;
  if (adminCredentialInfo.initError) {
    return `The server’s Firebase service-account key is malformed (${adminCredentialInfo.initError}), so sign-in can’t finish. An administrator needs to re-copy the key from the Firebase console into ${adminCredentialInfo.source} in the hosting environment variables and redeploy.`;
  }
  if (/Could not load the default credentials/i.test(message)) {
    const missing = adminCredentialInfo.missing.length ? ` Missing on the server: ${adminCredentialInfo.missing.join(', ')}.` : '';
    return `The server has no Firebase credentials, so sign-in can’t finish.${missing} An administrator needs to set them in the hosting environment variables (available to Functions) and redeploy.`;
  }
  if (
    code === 16 ||
    /UNAUTHENTICATED|invalid_grant|account not found|invalid_client|Invalid JWT|error:1E08010C|DECODER routines/i.test(message)
  ) {
    return 'The server’s Firebase credentials are invalid or missing, so accounts can’t be set up. An administrator needs to generate a new service-account key in the Firebase console and update the server’s environment variables.';
  }
  if (code === 7 || /PERMISSION_DENIED/i.test(message)) {
    return 'The server’s Firebase service account doesn’t have permission to use the database. Check that the key belongs to the right Firebase project.';
  }
  return null;
}
