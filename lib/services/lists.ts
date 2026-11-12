import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { ContactList } from '@/types';

/** Firestore allows 500 writes per batch; stay well under it. */
const BATCH_SIZE = 400;

export const MAX_LIST_NAME = 60;
export const MAX_TAG_LENGTH = 40;

const listsPath = (orgId: string) => `organizations/${orgId}/lists`;
const contactsPath = (orgId: string) => `organizations/${orgId}/contacts`;

// ---------- Lists ----------

export function subscribeLists(
  orgId: string,
  onData: (lists: ContactList[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, listsPath(orgId)), orderBy('name')),
    (snap) => onData(snap.docs.map((d) => d.data() as ContactList)),
    (error) => {
      console.error('Lists subscription error:', error);
      onError?.(error);
    }
  );
}

/** Trim, collapse spaces and cap the length of a list name. */
export function cleanListName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, MAX_LIST_NAME);
}

/** An existing list with the same name, ignoring case and spacing. */
export function findListByName(lists: ContactList[], name: string): ContactList | undefined {
  const key = cleanListName(name).toLowerCase();
  return lists.find((l) => l.name.toLowerCase() === key);
}

export async function createList(orgId: string, name: string, userId: string): Promise<ContactList> {
  const clean = cleanListName(name);
  if (!clean) throw new Error('Give the list a name.');
  const now = new Date().toISOString();
  const list: ContactList = {
    id: `list_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    orgId,
    name: clean,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(doc(db, listsPath(orgId), list.id), list);
  return list;
}

export async function renameList(orgId: string, listId: string, name: string): Promise<void> {
  const clean = cleanListName(name);
  if (!clean) throw new Error('Give the list a name.');
  await updateDoc(doc(db, listsPath(orgId), listId), { name: clean, updatedAt: new Date().toISOString() });
}

/** Delete a list. Its contacts are kept — they're only taken out of the list. */
export async function deleteList(orgId: string, listId: string): Promise<void> {
  const members = await getDocs(query(collection(db, contactsPath(orgId)), where('listIds', 'array-contains', listId)));
  await updateContacts(orgId, members.docs.map((d) => d.id), { listIds: arrayRemove(listId) });
  await deleteDoc(doc(db, listsPath(orgId), listId));
}

export function addContactsToList(orgId: string, listId: string, contactIds: string[]): Promise<void> {
  return updateContacts(orgId, contactIds, { listIds: arrayUnion(listId) });
}

export function removeContactsFromList(orgId: string, listId: string, contactIds: string[]): Promise<void> {
  return updateContacts(orgId, contactIds, { listIds: arrayRemove(listId) });
}

// ---------- Tags ----------

/** Trim, collapse spaces, drop commas (the tag separator) and cap the length. */
export function cleanTag(tag: string): string {
  return tag.replace(/,/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_TAG_LENGTH);
}

/**
 * Clean and de-duplicate tags, reusing the spelling of a tag that already exists in the
 * workspace ("VIP" stays "VIP" if someone types "vip") so filters don't split in two.
 */
export function resolveTags(input: string[], existingTags: string[]): string[] {
  const existing = new Map(existingTags.map((t) => [t.toLowerCase(), t]));
  const out = new Map<string, string>();
  for (const raw of input) {
    const tag = cleanTag(raw);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (!out.has(key)) out.set(key, existing.get(key) || tag);
  }
  return [...out.values()];
}

export function addTagsToContacts(orgId: string, contactIds: string[], tags: string[]): Promise<void> {
  if (!tags.length) return Promise.resolve();
  return updateContacts(orgId, contactIds, { tags: arrayUnion(...tags) });
}

export function removeTagsFromContacts(orgId: string, contactIds: string[], tags: string[]): Promise<void> {
  if (!tags.length) return Promise.resolve();
  return updateContacts(orgId, contactIds, { tags: arrayRemove(...tags) });
}

// ---------- Shared ----------

/** Apply the same field update to many contacts, in batches. */
async function updateContacts(orgId: string, contactIds: string[], fields: Record<string, unknown>): Promise<void> {
  const ids = [...new Set(contactIds)];
  const updatedAt = new Date().toISOString();
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    for (const id of ids.slice(i, i + BATCH_SIZE)) {
      batch.update(doc(db, contactsPath(orgId), id), { ...fields, updatedAt });
    }
    await batch.commit();
  }
}
