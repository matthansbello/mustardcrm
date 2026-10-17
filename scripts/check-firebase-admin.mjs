#!/usr/bin/env node
/**
 * Verifies the server's Firebase Admin credentials — the ones /api/auth/sync uses at sign-up.
 *
 *   npm run check:firebase
 *
 * Reads .env.local (or the current environment), mints an OAuth token with the service-account
 * key, then does one read-only Firestore query. Prints no secrets.
 */
import fs from 'node:fs';
import path from 'node:path';
import admin from 'firebase-admin';

const envFile = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envFile)) {
  const text = fs.readFileSync(envFile, 'utf8');
  for (const match of text.matchAll(/^\s*([A-Z0-9_]+)\s*=\s*("(?:[^"\\]|\\.)*"|'[^']*'|[^\n#]*)/gm)) {
    if (process.env[match[1]] === undefined) process.env[match[1]] = match[2].trim();
  }
}

const clean = (v) => (v || '').trim().replace(/^["']|["']$/g, '');
const projectId = clean(process.env.FIREBASE_PROJECT_ID) || clean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);

let account = null;
let source = '';
if (clean(process.env.FIREBASE_SERVICE_ACCOUNT)) {
  try {
    const j = JSON.parse(clean(process.env.FIREBASE_SERVICE_ACCOUNT));
    account = { projectId: j.project_id, clientEmail: j.client_email, privateKey: String(j.private_key).replace(/\\n/g, '\n') };
    source = 'FIREBASE_SERVICE_ACCOUNT';
  } catch {
    fail('FIREBASE_SERVICE_ACCOUNT is set but is not valid JSON. Paste the entire downloaded key file.');
  }
} else if (clean(process.env.FIREBASE_CLIENT_EMAIL) && clean(process.env.FIREBASE_PRIVATE_KEY)) {
  account = {
    projectId,
    clientEmail: clean(process.env.FIREBASE_CLIENT_EMAIL),
    privateKey: clean(process.env.FIREBASE_PRIVATE_KEY).replace(/\\n/g, '\n'),
  };
  source = 'FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY';
} else {
  fail('No credentials found. Set FIREBASE_SERVICE_ACCOUNT, or FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.');
}

const accountProject = account.clientEmail?.split('@')[1]?.split('.')[0];
console.log(`App project:       ${projectId}`);
console.log(`Credentials from:  ${source}`);
console.log(`Service account:   ${account.clientEmail}`);
if (accountProject !== projectId) {
  fail(`The service account belongs to project "${accountProject}", but the app uses "${projectId}". Generate a key in the "${projectId}" project.`);
}
if (!account.privateKey.includes('BEGIN PRIVATE KEY')) {
  fail('The private key is malformed (missing "BEGIN PRIVATE KEY"). Re-copy it from the downloaded JSON file.');
}

const credential = admin.credential.cert(account);
try {
  await credential.getAccessToken();
  console.log('✓ Key accepted by Google');
} catch (e) {
  const msg = e?.message || String(e);
  if (/account not found/i.test(msg)) {
    fail('Google says this service account does not exist (it was deleted, or the key is for a recreated project). Generate a new key.');
  }
  if (/Invalid JWT Signature/i.test(msg)) {
    fail('This key has been revoked or deleted. Generate a new key.');
  }
  fail(`Google rejected the key: ${msg}`);
}

admin.initializeApp({ credential, projectId });
try {
  await admin.firestore().collection('organizations').limit(1).get();
  console.log('✓ Firestore reachable — sign-up will work with these credentials');
} catch (e) {
  fail(`Key works, but Firestore access failed: ${e?.message || e}. Make sure Firestore is enabled in "${projectId}".`);
}

function fail(message) {
  console.error(`✗ ${message}`);
  console.error('  Fix: Firebase console → Project settings → Service accounts → Generate new private key.');
  process.exit(1);
}
