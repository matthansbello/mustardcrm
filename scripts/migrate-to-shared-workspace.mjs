#!/usr/bin/env node
/**
 * One-time migration: merge every existing organization (old per-domain and
 * personal Gmail workspaces) into the single shared workspace so all users
 * see all contacts.
 *
 *   node scripts/migrate-to-shared-workspace.mjs           # dry run — prints what would change
 *   node scripts/migrate-to-shared-workspace.mjs --apply   # actually writes
 *
 * Reads Firebase Admin credentials + MUSTARD_* settings from .env.local.
 * Source orgs are left in place (copy, not move) so nothing is lost.
 */
import fs from 'node:fs';
import path from 'node:path';
import admin from 'firebase-admin';

const APPLY = process.argv.includes('--apply');

loadEnvFile(path.resolve(process.cwd(), '.env.local'));

const SHARED_ORG_ID = process.env.MUSTARD_WORKSPACE_ID || 'org_mustard';
const SHARED_ORG_NAME = process.env.MUSTARD_WORKSPACE_NAME || 'Mustard Workspace';
const ADMIN_EMAILS = new Set(
  (process.env.MUSTARD_ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
);
// Aggregates and send bookkeeping would double-count if merged.
const SKIP_COLLECTIONS = new Set(['stats', 'sendAttempts', 'mailboxCaps']);

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
admin.initializeApp({
  credential: admin.credential.cert({ projectId, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey }),
});
const db = admin.firestore();

const counts = {};
const bump = (key) => (counts[key] = (counts[key] || 0) + 1);

let writer = APPLY ? db.bulkWriter() : null;
const write = (ref, data) => {
  bump(ref.parent.id);
  if (writer) writer.set(ref, data, { merge: true });
};

async function main() {
  console.log(`${APPLY ? 'APPLYING' : 'DRY RUN'} — merging all organizations into ${SHARED_ORG_ID}\n`);

  const target = db.collection('organizations').doc(SHARED_ORG_ID);
  const targetSnap = await target.get();
  const orgs = (await db.collection('organizations').get()).docs.filter((d) => d.id !== SHARED_ORG_ID);

  if (!targetSnap.exists) {
    const template = orgs[0]?.data() || {};
    const now = new Date().toISOString();
    write(target, {
      ...template,
      id: SHARED_ORG_ID,
      name: SHARED_ORG_NAME,
      createdAt: now,
      updatedAt: now,
    });
  }

  const seenEmails = new Set(
    (await target.collection('contacts').select('email').get()).docs.map((d) => String(d.get('email') || '').toLowerCase())
  );
  const seenUsers = new Set((await target.collection('users').select().get()).docs.map((d) => d.id));

  for (const org of orgs) {
    console.log(`• ${org.id}`);
    for (const col of await org.ref.listCollections()) {
      if (SKIP_COLLECTIONS.has(col.id)) continue;
      for (const docSnap of (await col.get()).docs) {
        const data = docSnap.data();

        if (col.id === 'contacts') {
          const email = String(data.email || '').toLowerCase();
          if (email && seenEmails.has(email)) {
            bump('contacts (duplicate email, skipped)');
            continue;
          }
          if (email) seenEmails.add(email);
        }

        if (col.id === 'users') {
          if (seenUsers.has(docSnap.id) || data.status === 'inactive') continue;
          seenUsers.add(docSnap.id);
          // Everyone was "admin" of their personal org — don't carry that over.
          data.role = ADMIN_EMAILS.has(String(data.email || '').toLowerCase()) ? 'admin' : data.role === 'admin' ? 'rep' : data.role;
        }

        await copyTree(docSnap.ref, target.collection(col.id).doc(docSnap.id), data);
      }
    }
  }

  // Point stored Gmail tokens at the shared workspace so sending/reply detection keep working.
  for (const tok of (await db.collection('tokens').get()).docs) {
    if (tok.get('orgId') !== SHARED_ORG_ID) write(tok.ref, { orgId: SHARED_ORG_ID });
  }

  if (writer) await writer.close();

  console.log('\nDocuments', APPLY ? 'written' : 'that would be written', 'per collection:');
  console.table(counts);
  if (ADMIN_EMAILS.size === 0) {
    console.warn('\n⚠  MUSTARD_ADMIN_EMAILS is empty — migrated admins become reps. Set it so someone can manage the team.');
  }
  if (!APPLY) console.log('\nRe-run with --apply to perform the migration.');
}

async function copyTree(srcRef, dstRef, data) {
  write(dstRef, { ...data, ...('orgId' in data ? { orgId: SHARED_ORG_ID } : {}) });
  for (const sub of await srcRef.listCollections()) {
    for (const child of (await sub.get()).docs) {
      await copyTree(child.ref, dstRef.collection(sub.id).doc(child.id), child.data());
    }
  }
}

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, 'utf8');
  for (const match of text.matchAll(/^\s*([A-Z0-9_]+)\s*=\s*("(?:[^"\\]|\\.)*"|[^\n#]*)/gm)) {
    const [, key, raw] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = raw.trim().replace(/^"|"$/g, '');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
