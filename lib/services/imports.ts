import { doc, setDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { ImportJob } from '@/types';
import type { ParsedRow } from '@/lib/importer/parser';
import { batchCreateContacts, getExistingEmailIndex } from './contacts';
import { addContactsToList } from './lists';

export interface ImportSummary {
  jobId: string;
  imported: number;
  /** Already in the workspace before this import. */
  existingDuplicates: number;
  /** Repeated inside the uploaded file. */
  fileDuplicates: number;
  invalid: number;
  /** Contacts from the file now in the chosen list (new ones plus ones already in the workspace). */
  addedToList: number;
}

/**
 * Import parsed spreadsheet rows as contacts in the shared workspace.
 * This is the single write path for CSV/XLSX imports: rows are de-duplicated
 * against existing contacts, written in batches, and an import record is saved
 * afterwards with status "completed" (so the server-side processor skips it).
 */
export async function importContacts(params: {
  orgId: string;
  ownerId: string;
  fileName: string;
  rows: ParsedRow[];
  columnMapping: Record<string, string>;
  /** Put every valid contact from the file into this list — including ones already in the workspace. */
  listId?: string;
  onProgress?: (processed: number, total: number) => void;
}): Promise<ImportSummary> {
  const { orgId, ownerId, fileName, rows, columnMapping, listId, onProgress } = params;
  const jobId = `import_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const startedAt = new Date().toISOString();

  const existing = await getExistingEmailIndex(orgId);
  const valid = rows.filter((r) => r.isValid);
  const toCreate = valid.filter((r) => !existing.has(r.email));
  const existingDuplicates = valid.length - toCreate.length;
  const fileDuplicates = rows.filter((r) => r.error === 'Duplicate email within file').length;
  const invalid = rows.length - valid.length - fileDuplicates;

  const imported = toCreate.length
    ? await batchCreateContacts(
        orgId,
        toCreate.map((r) => ({
          email: r.email,
          firstName: r.firstName,
          lastName: r.lastName,
          title: r.title || undefined,
          companyName: r.companyName || undefined,
          phone: r.phone || undefined,
          tags: r.tags,
          ownerId,
          lifecycleStage: 'lead' as const,
          customFields: r.customFields,
          ...(listId ? { listIds: [listId] } : {}),
        })),
        onProgress
      )
    : 0;
  if (!toCreate.length) onProgress?.(1, 1);

  // People in the file who were already in the workspace join the list too.
  const existingIds = listId
    ? [...new Set(valid.map((r) => existing.get(r.email)).filter((id): id is string => Boolean(id)))]
    : [];
  if (listId && existingIds.length) await addContactsToList(orgId, listId, existingIds);
  const addedToList = listId ? imported + existingIds.length : 0;

  const job: ImportJob = {
    id: jobId,
    orgId,
    type: 'contacts',
    fileName,
    storagePath: '',
    totalRows: rows.length,
    processedRows: rows.length,
    validCount: imported,
    warningCount: 0,
    errorCount: invalid,
    duplicateCount: existingDuplicates + fileDuplicates,
    status: 'completed',
    columnMapping,
    ownerId,
    createdAt: startedAt,
    updatedAt: new Date().toISOString(),
  };
  // The import itself already succeeded; the audit record is best-effort.
  await setDoc(doc(db, `organizations/${orgId}/importJobs`, jobId), job).catch((err) =>
    console.warn('Could not record import job:', err)
  );

  return { jobId, imported, existingDuplicates, fileDuplicates, invalid, addedToList };
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
