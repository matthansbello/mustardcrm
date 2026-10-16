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
import { X, UploadCloud, FileText, CheckCircle2, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { useModalReveal } from '@/lib/hooks/useModalReveal';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (count: number) => void;
}

const FIELD_OPTIONS = [
  { label: 'Email Address', value: 'email' },
  { label: 'First Name', value: 'firstName' },
  { label: 'Last Name', value: 'lastName' },
  { label: 'Company Name', value: 'companyName' },
  { label: 'Job Title', value: 'title' },
  { label: 'Phone Number', value: 'phone' },
  { label: 'Tags', value: 'tags' },
  { label: 'Skip / Ignore', value: 'ignore' },
];

export const BulkImportModal: React.FC<BulkImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user, organization } = useAuthStore();
  const { panelRef, backdropRef } = useModalReveal(isOpen);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [isParsing, setIsParsing] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

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

  return (
    <div ref={backdropRef} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div ref={panelRef} className="w-full max-w-2xl glass-panel p-6 md:p-8 rounded-3xl border border-blue-400/20 space-y-6 relative max-h-[90vh] overflow-y-auto shadow-glow-blue">
        <button
          onClick={handleClose}
          disabled={step === 3}
          aria-label="Close"
          className="absolute right-4 top-4 text-gray-400 hover:text-white p-1 disabled:opacity-30"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 border-b border-white/10 pb-4">
          <div className="p-2.5 rounded-xl bg-blue-500/15 border border-blue-400/30 text-blue-300">
            <UploadCloud className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold font-display text-white">Bulk Contact Import</h3>
            <p className="text-xs text-dark-muted">Import CSV or Excel with mapping, validation, and live progress</p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files[0]) handleFileDrop(e.dataTransfer.files[0]);
              }}
              className="border-2 border-dashed border-blue-400/40 hover:border-cyan-400 bg-blue-500/5 hover:bg-blue-500/10 transition-all rounded-3xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer text-center group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,.txt,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFileDrop(e.target.files[0]);
                }}
              />
              <FileText className="w-10 h-10 text-blue-300 group-hover:scale-110 transition-transform" />
              <div>
                <p className="text-sm font-semibold text-white">
                  {isParsing ? 'Reading file…' : 'Drag & drop a .csv or .xlsx file here, or click to choose'}
                </p>
                <p className="text-xs text-dark-muted mt-1">
                  CSV, XLSX or XLS · first row must be column headers · up to {MAX_IMPORT_ROWS.toLocaleString()} rows
                </p>
              </div>
              {isParsing && <Loader2 className="w-5 h-5 text-cyan-300 animate-spin mt-2" />}
            </label>
          </div>
        )}

        {step === 2 && parseResult && (
          <div className="space-y-6">
            <p className="text-xs text-dark-muted">
              <span className="text-white font-medium">{file?.name}</span> · {parseResult.totalRows.toLocaleString()} rows
              found
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-center">
                <span className="text-xl font-bold text-emerald-400 font-display">{parseResult.validCount}</span>
                <p className="text-[11px] text-emerald-300">Valid Leads</p>
              </div>
              <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-center">
                <span className="text-xl font-bold text-amber-400 font-display">{parseResult.duplicateCount}</span>
                <p className="text-[11px] text-amber-300">In-file Duplicates</p>
              </div>
              <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-center">
                <span className="text-xl font-bold text-rose-400 font-display">{parseResult.errorCount}</span>
                <p className="text-[11px] text-rose-300">Errors</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Column Header Mapping</h4>
                <span className="text-[11px] text-dark-muted">Select field targets for each column</span>
              </div>

              <div className="max-h-60 overflow-y-auto rounded-xl border border-white/10 bg-white/5 divide-y divide-white/5 text-xs">
                {parseResult.headers.map((header) => {
                  const currentVal = columnMapping[header] || customFieldKey(header);

                  return (
                    <div key={header} className="p-3 flex items-center justify-between gap-3">
                      <span className="text-gray-200 font-medium truncate max-w-[200px]" title={header}>
                        {header}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                      <select
                        value={currentVal}
                        onChange={(e) => handleMappingChange(header, e.target.value)}
                        className="bg-dark-bg border border-white/15 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-mustard-400"
                      >
                        {FIELD_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                        {!FIELD_OPTIONS.some((o) => o.value === currentVal) && (
                          <option value={currentVal}>Custom Field ({currentVal.replace(/^custom_/, '')})</option>
                        )}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>

            {!emailMapped && (
              <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-300 text-xs">
                No column is mapped to <strong>Email Address</strong>. Pick the column that holds emails above.
              </div>
            )}

            {emailMapped && problemRows.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Rows that will be skipped ({problemRows.length})
                </h4>
                <div className="max-h-32 overflow-y-auto rounded-xl border border-white/10 bg-white/5 divide-y divide-white/5 text-[11px]">
                  {problemRows.slice(0, 50).map((r) => (
                    <div key={r.rowNumber} className="px-3 py-1.5 flex gap-3">
                      <span className="text-dark-muted font-mono shrink-0">Row {r.rowNumber}</span>
                      <span className="text-gray-300 truncate">{r.error}</span>
                    </div>
                  ))}
                  {problemRows.length > 50 && (
                    <div className="px-3 py-1.5 text-dark-muted">…and {problemRows.length - 50} more</div>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
              <button onClick={reset} className="glass-button px-4 py-2 text-xs font-medium text-gray-300">
                Back
              </button>
              <button
                onClick={handleStartImport}
                disabled={parseResult.validCount === 0}
                className="btn-mustard px-5 py-2 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
              >
                <span>Import {parseResult.validCount} Contacts</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="py-12 text-center space-y-4">
            <div className="w-20 h-20 rounded-full border-4 border-white/10 border-t-mustard-500 animate-spin mx-auto flex items-center justify-center">
              <span className="text-sm font-bold text-white font-mono">{importProgress}%</span>
            </div>
            <div>
              <h4 className="text-lg font-bold text-white font-display">Importing Contacts...</h4>
              <p className="text-xs text-dark-muted">Saving to your workspace — keep this window open.</p>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="py-8 text-center space-y-6">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-2xl font-bold text-white font-display">Import Complete</h4>
              <p className="text-xs text-dark-muted mt-1">
                Added <span className="text-emerald-400 font-bold">{summary?.imported ?? 0}</span> new contacts
              </p>
              {summary && (summary.existingDuplicates > 0 || summary.fileDuplicates > 0 || summary.invalid > 0) && (
                <p className="text-[11px] text-dark-muted mt-2">
                  Skipped
                  {summary.existingDuplicates > 0 && (
                    <> · <span className="text-amber-400 font-bold">{summary.existingDuplicates}</span> already in workspace</>
                  )}
                  {summary.fileDuplicates > 0 && (
                    <> · <span className="text-amber-400 font-bold">{summary.fileDuplicates}</span> repeated in file</>
                  )}
                  {summary.invalid > 0 && (
                    <> · <span className="text-rose-400 font-bold">{summary.invalid}</span> missing/invalid email</>
                  )}
                </p>
              )}
            </div>
            <button onClick={handleClose} className="btn-mustard px-6 py-2.5 rounded-xl text-xs font-semibold">
              Done & View Contacts
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
