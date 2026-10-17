import * as admin from 'firebase-admin';

/**
 * Firebase Admin credentials, in order of preference:
 *  1. FIREBASE_SERVICE_ACCOUNT — the whole service-account JSON file pasted as one value
 *     (least error-prone on Netlify: no newline escaping to get wrong).
 *  2. FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.
 * With neither (and no emulator), server routes that touch Firestore will fail.
 */

const clean = (v?: string) => (v || '').trim().replace(/^["']|["']$/g, '');

const projectId =
  clean(process.env.FIREBASE_PROJECT_ID) || clean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) || 'demo-project';

/** Which credential source was used, and which env vars were missing — names only, never values. */
export const adminCredentialInfo: { source: string; missing: string[] } = { source: 'none', missing: [] };

function loadServiceAccount(): admin.ServiceAccount | null {
  const json = clean(process.env.FIREBASE_SERVICE_ACCOUNT);
  if (json) {
    try {
      const parsed = JSON.parse(json);
      adminCredentialInfo.source = 'FIREBASE_SERVICE_ACCOUNT';
      return {
        projectId: parsed.project_id || projectId,
        clientEmail: parsed.client_email,
        privateKey: String(parsed.private_key || '').replace(/\\n/g, '\n'),
      };
    } catch {
      console.error('[firebase-admin] FIREBASE_SERVICE_ACCOUNT is not valid JSON — paste the whole key file contents.');
      adminCredentialInfo.missing.push('FIREBASE_SERVICE_ACCOUNT (not valid JSON)');
    }
  }

  const clientEmail = clean(process.env.FIREBASE_CLIENT_EMAIL);
  const privateKey = clean(process.env.FIREBASE_PRIVATE_KEY).replace(/\\n/g, '\n');
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

if (!admin.apps.length) {
  const account = loadServiceAccount();

  if (account) {
    const accountProject = account.clientEmail?.split('@')[1]?.split('.')[0];
    if (accountProject && accountProject !== projectId && !usingEmulator) {
      console.error(
        `[firebase-admin] Service account ${account.clientEmail} belongs to project "${accountProject}" but the app uses "${projectId}". ` +
          'Generate a key for the right project (Firebase console → Project settings → Service accounts).'
      );
    }
    admin.initializeApp({
      credential: admin.credential.cert(account),
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
    admin.initializeApp({ projectId });
  }
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
export const adminStorage = admin.storage();

/**
 * Turn Admin SDK credential failures (gRPC 16 UNAUTHENTICATED, invalid_grant, missing
 * default credentials, 7 PERMISSION_DENIED) into a message that says what to fix.
 * Returns null for unrelated errors.
 */
export function describeAdminCredentialError(err: unknown): string | null {
  const message = err instanceof Error ? err.message : String(err);
  const code = (err as { code?: unknown })?.code;
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
