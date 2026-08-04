import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '@/lib/firebase/client';
import { ImportJob, ImportJobType } from '@/types';

export async function createImportJob(params: {
  orgId: string;
  file: File;
  ownerId: string;
  columnMapping: Record<string, string>;
  totalRows: number;
  type?: ImportJobType;
}): Promise<ImportJob> {
  const { orgId, file, ownerId, columnMapping, totalRows, type = 'contacts' } = params;
  const jobId = `import_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const storagePath = `organizations/${orgId}/imports/${jobId}_${file.name}`;
  const now = new Date().toISOString();

  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file, { contentType: file.type || 'text/csv' });

  const job: ImportJob = {
    id: jobId,
    orgId,
    type,
    fileName: file.name,
    storagePath,
    totalRows,
    processedRows: 0,
    validCount: 0,
    warningCount: 0,
    errorCount: 0,
    duplicateCount: 0,
    status: 'pending',
    columnMapping,
    ownerId,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(doc(db, `organizations/${orgId}/importJobs`, jobId), job);
  return job;
}

export function subscribeImportJob(
  orgId: string,
  jobId: string,
  onData: (job: ImportJob) => void
): Unsubscribe {
  return onSnapshot(doc(db, `organizations/${orgId}/importJobs`, jobId), (snap) => {
    if (snap.exists()) {
      onData(snap.data() as ImportJob);
    }
  });
}
