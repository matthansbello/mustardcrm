import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  query,
  where,
  writeBatch,
  onSnapshot,
  orderBy,
  limit,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Contact, ActivityItem } from '@/types';

export function subscribeContacts(
  orgId: string,
  onData: (contacts: Contact[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const contactsRef = collection(db, `organizations/${orgId}/contacts`);
  const q = query(contactsRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const contacts: Contact[] = [];
      snapshot.forEach((docSnap) => {
        contacts.push(docSnap.data() as Contact);
      });
      onData(contacts);
    },
    (error) => {
      console.error('Contacts subscription error:', error);
      onError?.(error);
    }
  );
}

export async function getContacts(orgId: string): Promise<Contact[]> {
  try {
    const contactsRef = collection(db, `organizations/${orgId}/contacts`);
    const snapshot = await getDocs(query(contactsRef, orderBy('createdAt', 'desc')));
    const contacts: Contact[] = [];
    snapshot.forEach((docSnap) => {
      contacts.push(docSnap.data() as Contact);
    });
    return contacts;
  } catch (error) {
    console.error('Error fetching contacts:', error);
    return [];
  }
}

export async function checkDuplicateEmail(orgId: string, email: string): Promise<boolean> {
  if (!email || !email.includes('@')) return false;
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const contactsRef = collection(db, `organizations/${orgId}/contacts`);
    const q = query(contactsRef, where('email', '==', normalizedEmail), limit(1));
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  } catch (error) {
    console.warn('Duplicate check fallback:', error);
    return false;
  }
}

export async function getContactActivity(
  orgId: string,
  contactId: string
): Promise<ActivityItem[]> {
  try {
    const activityRef = collection(
      db,
      `organizations/${orgId}/contacts/${contactId}/activity`
    );
    const snap = await getDocs(query(activityRef, orderBy('timestamp', 'desc'), limit(50)));
    const items: ActivityItem[] = [];
    snap.forEach((d) => items.push(d.data() as ActivityItem));
    return items;
  } catch (error) {
    console.error('Error fetching activity:', error);
    return [];
  }
}

export function subscribeContactActivity(
  orgId: string,
  contactId: string,
  onData: (items: ActivityItem[]) => void
): Unsubscribe {
  const activityRef = collection(
    db,
    `organizations/${orgId}/contacts/${contactId}/activity`
  );
  const q = query(activityRef, orderBy('timestamp', 'desc'), limit(50));
  return onSnapshot(q, (snap) => {
    const items: ActivityItem[] = [];
    snap.forEach((d) => items.push(d.data() as ActivityItem));
    onData(items);
  });
}

export async function createContact(
  orgId: string,
  contactData: Omit<Contact, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>
): Promise<Contact> {
  const contactId = `contact_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();

  const newContact: Contact = {
    ...contactData,
    id: contactId,
    orgId,
    email: contactData.email.toLowerCase().trim(),
    tags: contactData.tags || [],
    customFields: contactData.customFields || {},
    createdAt: now,
    updatedAt: now,
  };

  const contactRef = doc(db, `organizations/${orgId}/contacts`, contactId);
  await setDoc(contactRef, newContact);

  const activityId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const activityRef = doc(
    db,
    `organizations/${orgId}/contacts/${contactId}/activity`,
    activityId
  );
  const initialActivity: ActivityItem = {
    id: activityId,
    contactId,
    type: 'contact_created',
    title: 'Contact Created',
    description: 'Added manually',
    timestamp: now,
    actorId: contactData.ownerId,
  };
  await setDoc(activityRef, initialActivity);

  return newContact;
}

export async function batchCreateContacts(
  orgId: string,
  contacts: Omit<Contact, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>[],
  onProgress?: (processed: number, total: number) => void
): Promise<number> {
  const chunkSize = 400;
  let processed = 0;
  const now = new Date().toISOString();

  for (let i = 0; i < contacts.length; i += chunkSize) {
    const batch = writeBatch(db);
    const chunk = contacts.slice(i, i + chunkSize);

    chunk.forEach((c, idx) => {
      const contactId = `contact_${Date.now()}_${i}_${idx}_${Math.random().toString(36).substring(2, 7)}`;
      const contactRef = doc(db, `organizations/${orgId}/contacts`, contactId);
      batch.set(contactRef, {
        ...c,
        id: contactId,
        orgId,
        email: c.email.toLowerCase().trim(),
        tags: c.tags || [],
        customFields: c.customFields || {},
        createdAt: now,
        updatedAt: now,
      });
    });

    await batch.commit();
    processed += chunk.length;
    onProgress?.(processed, contacts.length);
  }

  return processed;
}

/**
 * Every email already in the workspace. Throws on failure — callers use this to
 * avoid duplicates, so silently returning an empty set would be unsafe.
 */
export async function getExistingEmailsSet(orgId: string): Promise<Set<string>> {
  const snapshot = await getDocs(collection(db, `organizations/${orgId}/contacts`));
  const emails = new Set<string>();
  snapshot.forEach((d) => {
    const email = String(d.get('email') || '').toLowerCase().trim();
    if (email) emails.add(email);
  });
  return emails;
}

export async function getContactById(
  orgId: string,
  contactId: string
): Promise<Contact | null> {
  const snap = await getDoc(doc(db, `organizations/${orgId}/contacts`, contactId));
  return snap.exists() ? (snap.data() as Contact) : null;
}
