import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'demo-project';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  const privateKey = rawKey
    ? rawKey.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n')
    : undefined;

  if (clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  } else {
    // Fallback for development / emulation
    admin.initializeApp({
      projectId,
    });
  }
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
export const adminStorage = admin.storage();
