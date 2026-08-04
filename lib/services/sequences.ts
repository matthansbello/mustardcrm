import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Sequence, SequenceStep, SequenceSettings, Enrollment, Contact } from '@/types';

export async function getSequences(orgId: string): Promise<Sequence[]> {
  if (!orgId) return [];
  try {
    const seqRef = collection(db, `organizations/${orgId}/sequences`);
    const snapshot = await getDocs(seqRef);
    const sequences: Sequence[] = [];
    snapshot.forEach((docSnap) => {
      sequences.push(docSnap.data() as Sequence);
    });
    return sequences;
  } catch (error) {
    console.error('Error fetching sequences:', error);
    return [];
  }
}

export async function createSequence(
  orgId: string,
  data: {
    name: string;
    steps: SequenceStep[];
    settings?: Partial<SequenceSettings>;
    createdBy: string;
  }
): Promise<Sequence> {
  const sequenceId = `seq_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const newSequence: Sequence = {
    id: sequenceId,
    orgId,
    name: data.name,
    status: 'draft',
    steps: data.steps,
    settings: {
      sendingWindow: data.settings?.sendingWindow || {
        startHour: 9,
        endHour: 17,
        timezone: 'America/New_York',
      },
      dailyCapPerMailbox: data.settings?.dailyCapPerMailbox || 50,
      senderUserIds: data.settings?.senderUserIds || [],
    },
    stats: {
      enrolled: 0,
      sent: 0,
      opened: 0,
      clicked: 0,
      replied: 0,
      bounced: 0,
    },
    createdBy: data.createdBy,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(doc(db, `organizations/${orgId}/sequences`, sequenceId), newSequence);
  return newSequence;
}

export async function enrollContacts(
  orgId: string,
  sequenceId: string,
  contacts: Contact[],
  firstStepDueAt?: string
): Promise<number> {
  const now = new Date().toISOString();
  const dueAt = firstStepDueAt || now;
  const chunkSize = 400;
  let enrolled = 0;

  for (let i = 0; i < contacts.length; i += chunkSize) {
    const batch = writeBatch(db);
    const chunk = contacts.slice(i, i + chunkSize);

    chunk.forEach((contact) => {
      const enrollment: Enrollment = {
        id: contact.id,
        orgId,
        sequenceId,
        contactId: contact.id,
        currentStepIndex: 0,
        status: 'active',
        nextSendDueAt: dueAt,
        history: [],
        createdAt: now,
        updatedAt: now,
      };
      const ref = doc(
        db,
        `organizations/${orgId}/sequences/${sequenceId}/enrollments`,
        contact.id
      );
      batch.set(ref, enrollment);
    });

    await batch.commit();
    enrolled += chunk.length;
  }

  return enrolled;
}

/**
 * Create sequence, enroll contacts, and set status to active.
 */
export async function createAndLaunchSequence(
  orgId: string,
  data: {
    name: string;
    steps: SequenceStep[];
    settings?: Partial<SequenceSettings>;
    createdBy: string;
    senderUserId: string;
    contacts: Contact[];
  }
): Promise<Sequence> {
  const sequence = await createSequence(orgId, {
    name: data.name,
    steps: data.steps,
    settings: {
      ...data.settings,
      senderUserIds: data.settings?.senderUserIds?.length
        ? data.settings.senderUserIds
        : [data.senderUserId],
    },
    createdBy: data.createdBy,
  });

  const enrolled = await enrollContacts(orgId, sequence.id, data.contacts);

  await updateDoc(doc(db, `organizations/${orgId}/sequences`, sequence.id), {
    status: 'active',
    'stats.enrolled': enrolled,
    updatedAt: new Date().toISOString(),
  });

  return {
    ...sequence,
    status: 'active',
    stats: { ...sequence.stats, enrolled },
  };
}

export async function launchSequence(orgId: string, sequenceId: string): Promise<void> {
  await updateDoc(doc(db, `organizations/${orgId}/sequences`, sequenceId), {
    status: 'active',
    updatedAt: new Date().toISOString(),
  });
}

export async function pauseSequence(orgId: string, sequenceId: string): Promise<void> {
  await updateDoc(doc(db, `organizations/${orgId}/sequences`, sequenceId), {
    status: 'paused',
    updatedAt: new Date().toISOString(),
  });
}
