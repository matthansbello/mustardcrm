import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  Auth,
  GoogleAuthProvider,
  OAuthProvider,
  GithubAuthProvider,
  connectAuthEmulator,
} from 'firebase/auth';
import { getFirestore, initializeFirestore, Firestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, FirebaseStorage, connectStorageEmulator } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'demo-project.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'demo-project',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'demo-project.appspot.com',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '000000000000',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:000000000000:web:000000000000',
};

// Initialize Firebase for Client Side
const isFirstInit = getApps().length === 0;
const app: FirebaseApp = isFirstInit ? initializeApp(firebaseConfig) : getApp();
const auth: Auth = getAuth(app);
// Optional fields (title, phone, …) are often undefined — drop them instead of
// letting Firestore reject the whole write.
const db: Firestore = isFirstInit
  ? initializeFirestore(app, { ignoreUndefinedProperties: true })
  : getFirestore(app);
const storage: FirebaseStorage = getStorage(app);

// `npm run emulators` + NEXT_PUBLIC_FIREBASE_EMULATORS=true for local testing without touching prod data.
if (isFirstInit && process.env.NEXT_PUBLIC_FIREBASE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
}
const googleProvider = new GoogleAuthProvider();

// Any Google account (gmail.com + Workspace). Do not set `hd` — that would
// restrict login to a single Workspace domain and block personal Gmail.
googleProvider.setCustomParameters({
  prompt: 'select_account',
  access_type: 'offline',
  include_granted_scopes: 'true',
});
googleProvider.addScope('https://www.googleapis.com/auth/userinfo.email');
googleProvider.addScope('https://www.googleapis.com/auth/userinfo.profile');
googleProvider.addScope('https://www.googleapis.com/auth/gmail.send');
googleProvider.addScope('https://www.googleapis.com/auth/gmail.readonly');

const microsoftProvider = new OAuthProvider('microsoft.com');
microsoftProvider.setCustomParameters({ prompt: 'select_account' });

const appleProvider = new OAuthProvider('apple.com');
appleProvider.addScope('email');
appleProvider.addScope('name');

const githubProvider = new GithubAuthProvider();
githubProvider.addScope('user:email');

export type OAuthProviderId = 'google' | 'microsoft' | 'apple' | 'github';

const oauthProviders = {
  microsoft: microsoftProvider,
  apple: appleProvider,
  github: githubProvider,
};

export { app, auth, db, storage, googleProvider, oauthProviders };
