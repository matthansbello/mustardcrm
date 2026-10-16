'use client';

import React, { useRef, useState } from 'react';
import { useAuthStore } from '@/lib/store/useAuthStore';
import {
  parseImportFile,
  ParseResult,
  mapAndValidateRows,
  customFieldKey,
  MAX_IMPORT_ROWS,
} from '@/lib/importer/parser';
import { importContacts, ImportSummary } from '@/lib/services/imports';
import { FileSpreadsheet, CheckCircle2, ArrowRight, Loader2, CircleAlert, Upload } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (count: number) => void;
}

const FIELD_OPTIONS = [
  { label: 'Email', value: 'email' },
  { label: 'First name', value: 'firstName' },
  { label: 'Last name', value: 'lastName' },
  { label: 'Company', value: 'companyName' },
  { label: 'Job title', value: 'title' },
  { label: 'Phone', value: 'phone' },
  { label: 'Tags', value: 'tags' },
  { label: 'Don’t import', value: 'ignore' },
];

const STEP_LABELS = ['Upload', 'Map columns', 'Import', 'Done'];

export const BulkImportModal: React.FC<BulkImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user, organization } = useAuthStore();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [isParsing, setIsParsing] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep(1);
    setFile(null);
    setParseResult(null);
    setColumnMapping({});
    setImportProgress(0);
    setSummary(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    if (step === 3) return; // don't abandon an import mid-write
    reset();
    onClose();
  };

  const handleFileDrop = async (droppedFile: File) => {
    setFile(droppedFile);
    setError(null);
    setIsParsing(true);
    try {
      const result = await parseImportFile(droppedFile);
      setParseResult(result);
      setColumnMapping(result.autoMapping);
      setStep(2);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not read this file.');
    } finally {
      setIsParsing(false);
      // Allow picking the same file again after fixing it.
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleMappingChange = (header: string, targetKey: string) => {
    if (!parseResult) return;
    const updatedMapping = { ...columnMapping, [header]: targetKey };
    setColumnMapping(updatedMapping);

    const revalidated = mapAndValidateRows(parseResult.rawRows, updatedMapping);
    setParseResult({
      ...parseResult,
      autoMapping: updatedMapping,
      rows: revalidated.rows,
      validCount: revalidated.validCount,
      duplicateCount: revalidated.duplicateCount,
      errorCount: revalidated.errorCount,
    });
  };

  const handleStartImport = async () => {
    if (!parseResult || !file) return;
    if (!organization?.id || !user?.id) {
      setError('Your session is still loading — wait a moment and try again.');
      return;
    }
    setError(null);
    setImportProgress(0);
    setStep(3);

    try {
      const result = await importContacts({
        orgId: organization.id,
        ownerId: user.id,
        fileName: file.name,
        rows: parseResult.rows,
        columnMapping,
        onProgress: (processed, total) => setImportProgress(Math.round((processed / total) * 100)),
      });
      setSummary(result);
      setStep(4);
      onSuccess(result.imported);
    } catch (err: unknown) {
      console.error('Import error:', err);
      const message = err instanceof Error ? err.message : 'Import failed';
      setError(
        /permission/i.test(message)
          ? 'You do not have permission to add contacts. Sign out and back in, then try again.'
          : `Import stopped: ${message}. Contacts saved before the error are kept — re-running the import skips them.`
      );
      setStep(2);
    }
  };

  const emailMapped = Object.values(columnMapping).includes('email');
  const problemRows = parseResult?.rows.filter((r) => !r.isValid) || [];

  const footer =
    step === 2 && parseResult ? (
      <>
        <button onClick={reset} className="btn btn-secondary">
          Back
        </button>
        <button onClick={handleStartImport} disabled={parseResult.validCount === 0 || !emailMapped} className="btn btn-primary">
          Import {parseResult.validCount.toLocaleString()} contacts
          <ArrowRight className="h-4 w-4" />
        </button>
      </>
    ) : step === 4 ? (
      <button onClick={handleClose} className="btn btn-primary">
        Done
      </button>
    ) : undefined;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      locked={step === 3}
      size="lg"
      title="Import contacts"
      description={`Step ${step} of 4 · ${STEP_LABELS[step - 1]}`}
      footer={footer}
    >
      {error && (
        <div className="alert alert-error mb-5">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {step === 1 && (
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files[0]) handleFileDrop(e.dataTransfer.files[0]);
          }}
          className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line-strong bg-canvas px-6 py-12 text-center transition-colors hover:border-accent hover:bg-accent-soft"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.tsv,.txt,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={(e) => {
              if (e.target.files?.[0]) handleFileDrop(e.target.files[0]);
            }}
          />
          <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-surface-2 text-fg-muted">
            {isParsing ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileSpreadsheet className="h-5 w-5" strokeWidth={1.75} />}
          </span>
          <div>
            <p className="text-sm font-medium text-fg">
              {isParsing ? 'Reading file…' : 'Drop a file here, or click to browse'}
            </p>
            <p className="mt-1 text-xs text-fg-muted">
              CSV, XLSX or XLS · first row must be column headers · up to {MAX_IMPORT_ROWS.toLocaleString()} rows
            </p>
          </div>
          <span className="btn btn-secondary btn-sm pointer-events-none mt-1">
            <Upload className="h-4 w-4" />
            Choose file
          </span>
        </label>
      )}

      {step === 2 && parseResult && (
        <div className="space-y-5">
          <div className="flex items-center gap-2 text-sm">
            <FileSpreadsheet className="h-4 w-4 text-fg-subtle" />
            <span className="font-medium text-fg">{file?.name}</span>
            <span className="text-fg-muted">· {parseResult.totalRows.toLocaleString()} rows</span>
          </div>

          <div className="grid grid-cols-3 divide-x divide-line rounded-lg border border-line text-center sm:text-left">
            {[
              { label: 'Ready to import', value: parseResult.validCount, tone: 'text-emerald-300' },
              { label: 'Duplicates in file', value: parseResult.duplicateCount, tone: 'text-amber-300' },
              { label: 'Missing / invalid email', value: parseResult.errorCount, tone: 'text-rose-300' },
            ].map((s) => (
              <div key={s.label} className="px-2 py-3 sm:px-4">
                <p className={`text-xl font-semibold tabular-nums ${s.tone}`}>{s.value.toLocaleString()}</p>
                <p className="mt-0.5 text-xs text-fg-muted">{s.label}</p>
              </div>
            ))}
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h3 className="text-sm font-semibold font-sans tracking-normal text-fg">Match columns to fields</h3>
              <span className="text-xs text-fg-subtle">Unmatched columns are saved as custom fields</span>
            </div>
            <div className="max-h-64 divide-y divide-line overflow-y-auto rounded-lg border border-line">
              {parseResult.headers.map((header) => {
                const currentVal = columnMapping[header] || customFieldKey(header);
                const sample = parseResult.rawRows.find((r) => String(r[header] ?? '').trim())?.[header];
                return (
                  <div key={header} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3 sm:py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-fg" title={header}>
                        {header}
                      </p>
                      {sample && <p className="truncate text-xs text-fg-subtle">e.g. {String(sample)}</p>}
                    </div>
                    <ArrowRight className="hidden h-3.5 w-3.5 shrink-0 text-fg-subtle sm:block" />
                    <select
                      value={currentVal}
                      onChange={(e) => handleMappingChange(header, e.target.value)}
                      aria-label={`Field for ${header}`}
                      className="input shrink-0 sm:h-8 sm:w-44"
                    >
                      {FIELD_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                      {!FIELD_OPTIONS.some((o) => o.value === currentVal) && (
                        <option value={currentVal}>Custom: {currentVal.replace(/^custom_/, '')}</option>
                      )}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>

          {!emailMapped && (
            <div className="alert alert-warning">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>No column is matched to Email. Choose the column that contains email addresses.</span>
            </div>
          )}

          {emailMapped && problemRows.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold font-sans tracking-normal text-fg">
                Rows that will be skipped ({problemRows.length.toLocaleString()})
              </h3>
              <div className="max-h-32 divide-y divide-line overflow-y-auto rounded-lg border border-line text-xs">
                {problemRows.slice(0, 50).map((r) => (
                  <div key={r.rowNumber} className="flex gap-3 px-3 py-1.5">
                    <span className="w-14 shrink-0 tabular-nums text-fg-subtle">Row {r.rowNumber}</span>
                    <span className="truncate text-fg-muted">{r.error}</span>
                  </div>
                ))}
                {problemRows.length > 50 && (
                  <div className="px-3 py-1.5 text-fg-subtle">…and {problemRows.length - 50} more</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="py-10 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-accent-fg" />
          <p className="mt-4 text-sm font-medium text-fg">Importing contacts… {importProgress}%</p>
          <div className="mx-auto mt-3 h-1.5 w-64 max-w-full overflow-hidden rounded-full bg-surface-3">
            <div className="h-full bg-accent transition-[width] duration-200" style={{ width: `${importProgress}%` }} />
          </div>
          <p className="mt-3 text-xs text-fg-muted">Keep this window open until it finishes.</p>
        </div>
      )}

      {step === 4 && (
        <div className="py-8 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" strokeWidth={1.5} />
          <p className="mt-4 text-lg font-semibold text-fg">
            {(summary?.imported ?? 0).toLocaleString()} contacts added
          </p>
          {summary && (summary.existingDuplicates > 0 || summary.fileDuplicates > 0 || summary.invalid > 0) && (
            <ul className="mx-auto mt-4 max-w-xs space-y-1 text-left text-sm text-fg-muted">
              {summary.existingDuplicates > 0 && (
                <li className="flex justify-between">
                  <span>Already in workspace</span>
                  <span className="tabular-nums">{summary.existingDuplicates}</span>
                </li>
              )}
              {summary.fileDuplicates > 0 && (
                <li className="flex justify-between">
                  <span>Repeated in file</span>
                  <span className="tabular-nums">{summary.fileDuplicates}</span>
                </li>
              )}
              {summary.invalid > 0 && (
                <li className="flex justify-between">
                  <span>Missing or invalid email</span>
                  <span className="tabular-nums">{summary.invalid}</span>
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
};
