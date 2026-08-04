'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/lib/store/useAuthStore';
import { parseImportFile, ParseResult } from '@/lib/importer/parser';
import { createImportJob, subscribeImportJob } from '@/lib/services/imports';
import { batchCreateContacts, getExistingEmailsSet } from '@/lib/services/contacts';
import { X, UploadCloud, FileText, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';
import { useModalReveal } from '@/lib/hooks/useModalReveal';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (count: number) => void;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user, organization } = useAuthStore();
  const { panelRef, backdropRef } = useModalReveal(isOpen);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [statusLabel, setStatusLabel] = useState('Starting import...');
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      unsubRef.current?.();
    };
  }, []);

  if (!isOpen) return null;

  const reset = () => {
    unsubRef.current?.();
    setStep(1);
    setFile(null);
    setParseResult(null);
    setImportProgress(0);
    setImportedCount(0);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFileDrop = async (droppedFile: File) => {
    setFile(droppedFile);
    setIsParsing(true);
    try {
      const result = await parseImportFile(droppedFile);
      setParseResult(result);
      setStep(2);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error parsing file');
    } finally {
      setIsParsing(false);
    }
  };

  const handleStartImport = async () => {
    if (!parseResult || !file || !organization?.id || !user?.id) return;
    setStep(3);
    setStatusLabel('Uploading file & creating import job...');

    try {
      // Prefer Cloud Function pipeline via Storage + importJobs
      const job = await createImportJob({
        orgId: organization.id,
        file,
        ownerId: user.id,
        columnMapping: parseResult.autoMapping,
        totalRows: parseResult.rows.length,
        type: 'contacts',
      });

      unsubRef.current = subscribeImportJob(organization.id, job.id, (live) => {
        const pct =
          live.totalRows > 0
            ? Math.round((live.processedRows / live.totalRows) * 100)
            : live.status === 'completed'
            ? 100
            : 10;
        setImportProgress(pct);
        setStatusLabel(`Status: ${live.status}`);
        setImportedCount(live.validCount);
        setDuplicateCount(live.duplicateCount);
        setErrorCount(live.errorCount);

        if (live.status === 'completed') {
          setStep(4);
          onSuccess(live.validCount);
          unsubRef.current?.();
        }
        if (live.status === 'failed') {
          setStatusLabel(live.errorMessage || 'Import failed');
          // Fall through to client fallback below is not possible here — show error state
        }
      });

      // Fallback: if CF never picks up within 8s, process client-side
      setTimeout(async () => {
        // Re-check via a one-shot — if still pending, do client import
        const { getDoc, doc } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase/client');
        const snap = await getDoc(doc(db, `organizations/${organization.id}/importJobs`, job.id));
        const live = snap.data();
        if (live && (live.status === 'pending' || live.status === 'validating')) {
          setStatusLabel('Cloud Function unavailable — importing client-side...');
          await clientSideImport();
        }
      }, 8000);
    } catch (error) {
      console.warn('Storage import failed, falling back to client:', error);
      setStatusLabel('Falling back to client-side import...');
      await clientSideImport();
    }
  };

  const clientSideImport = async () => {
    if (!parseResult || !organization?.id || !user?.id) return;

    const existing = await getExistingEmailsSet(organization.id);
    const validRows = parseResult.rows.filter((r) => r.isValid && !existing.has(r.email.toLowerCase()));
    const dups = parseResult.rows.filter((r) => r.isValid && existing.has(r.email.toLowerCase())).length;

    const contactsToCreate = validRows.map((r) => ({
      firstName: r.firstName || r.email.split('@')[0],
      lastName: r.lastName || '',
      email: r.email,
      title: r.title,
      companyName: r.companyName,
      phone: r.phone,
      tags: r.tags ? r.tags.split(',').map((t) => t.trim()) : ['csv_import'],
      ownerId: user.id,
      lifecycleStage: 'lead' as const,
      customFields: r.customFields || {},
    }));

    const count = await batchCreateContacts(
      organization.id,
      contactsToCreate,
      (processed, total) => {
        setImportProgress(Math.round((processed / total) * 100));
      }
    );
    setImportedCount(count);
    setDuplicateCount(dups + parseResult.duplicateCount);
    setErrorCount(parseResult.errorCount);
    setStep(4);
    onSuccess(count);
  };

  return (
    <div ref={backdropRef} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div ref={panelRef} className="w-full max-w-2xl glass-panel p-6 md:p-8 rounded-3xl border border-blue-400/20 space-y-6 relative max-h-[90vh] overflow-y-auto shadow-glow-blue">
        <button onClick={handleClose} className="absolute right-4 top-4 text-gray-400 hover:text-white p-1">
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
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFileDrop(e.target.files[0]);
                }}
              />
              <FileText className="w-10 h-10 text-blue-300 group-hover:scale-110 transition-transform" />
              <div>
                <p className="text-sm font-semibold text-white">
                  {isParsing ? 'Parsing file headers...' : 'Drag & drop `.csv` or `.xlsx` file here'}
                </p>
                <p className="text-xs text-dark-muted mt-1">Accepts CSV, XLSX, XLS up to 25,000 rows</p>
              </div>
              {isParsing && <Loader2 className="w-5 h-5 text-cyan-300 animate-spin mt-2" />}
            </label>
          </div>
        )}

        {step === 2 && parseResult && (
          <div className="space-y-6">
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
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Detected Column Mapping</h4>
              <div className="max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-white/5 divide-y divide-white/5 text-xs">
                {parseResult.headers.map((header) => (
                  <div key={header} className="p-3 flex items-center justify-between">
                    <span className="text-gray-300 font-medium">{header}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-gray-500" />
                    <span className="text-mustard-400 font-mono font-semibold">
                      {parseResult.autoMapping[header] || 'custom_field'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
              <button onClick={() => setStep(1)} className="glass-button px-4 py-2 text-xs font-medium text-gray-300">
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
              <p className="text-xs text-dark-muted">{statusLabel}</p>
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
                Added <span className="text-emerald-400 font-bold">{importedCount}</span>
                {duplicateCount > 0 && (
                  <> · skipped <span className="text-amber-400 font-bold">{duplicateCount}</span> duplicates</>
                )}
                {errorCount > 0 && (
                  <> · <span className="text-rose-400 font-bold">{errorCount}</span> errors</>
                )}
              </p>
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
