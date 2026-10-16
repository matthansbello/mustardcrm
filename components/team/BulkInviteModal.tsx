'use client';

import React, { useState } from 'react';
import { UserRole } from '@/types';
import { useAuthStore } from '@/lib/store/useAuthStore';
import { bulkInviteTeammates } from '@/lib/services/team';
import { parseImportFile } from '@/lib/importer/parser';
import { FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

interface BulkInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const BulkInviteModal: React.FC<BulkInviteModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { organization, user } = useAuthStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ invited: number; skipped: number; errors: string[] } | null>(null);

  const handleFile = async (file: File) => {
    if (!organization?.id || !user?.id) return;
    setIsProcessing(true);
    setResult(null);
    try {
      const parsed = await parseImportFile(file);
      const rows = parsed.rows
        .filter((r) => r.isValid)
        .map((r) => ({
          email: r.email,
          role: (r.customFields?.role as UserRole) || ('rep' as UserRole),
          displayName: [r.firstName, r.lastName].filter(Boolean).join(' ') || undefined,
        }));

      // Also accept role from title column if present
      const withRoles = parsed.rows.filter((r) => r.isValid).map((r) => {
        const roleRaw = (r.title || r.customFields?.role || 'rep').toString().toLowerCase();
        const role: UserRole =
          roleRaw.includes('admin') ? 'admin' : roleRaw.includes('manager') ? 'manager' : 'rep';
        return { email: r.email, role };
      });

      const outcome = await bulkInviteTeammates(
        organization.id,
        withRoles.length ? withRoles : rows,
        user.id
      );
      setResult(outcome);
      onSuccess();
    } catch (err) {
      setResult({
        invited: 0,
        skipped: 0,
        errors: [err instanceof Error ? err.message : 'Bulk invite failed'],
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      locked={isProcessing}
      title="Bulk invite"
      description="Invite several teammates at once from a spreadsheet."
      footer={
        <button onClick={onClose} disabled={isProcessing} className="btn btn-secondary">
          {result ? 'Done' : 'Cancel'}
        </button>
      }
    >
      <label className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border border-dashed border-line-strong bg-canvas px-6 py-10 text-center transition-colors hover:border-accent hover:bg-accent-soft">
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          className="sr-only"
          onChange={(e) => {
            if (e.target.files?.[0]) handleFile(e.target.files[0]);
            e.target.value = '';
          }}
        />
        <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-surface-2 text-fg-muted">
          {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileSpreadsheet className="h-5 w-5" strokeWidth={1.75} />}
        </span>
        <div>
          <p className="text-sm font-medium text-fg">{isProcessing ? 'Sending invites…' : 'Drop a CSV or Excel file'}</p>
          <p className="mt-1 text-xs text-fg-muted">
            Columns: <span className="text-fg">email</span>, and optionally name and{' '}
            <span className="text-fg">role</span> (admin, manager or rep).
          </p>
        </div>
        {!isProcessing && (
          <span className="btn btn-secondary btn-sm pointer-events-none">
            <Upload className="h-4 w-4" />
            Choose file
          </span>
        )}
      </label>

      {result && (
        <div className="mt-4 space-y-2">
          <div className="grid grid-cols-2 divide-x divide-line rounded-lg border border-line text-center">
            <div className="py-3">
              <p className="text-lg font-semibold tabular-nums text-emerald-300">{result.invited}</p>
              <p className="text-xs text-fg-muted">Invited</p>
            </div>
            <div className="py-3">
              <p className="text-lg font-semibold tabular-nums text-amber-300">{result.skipped}</p>
              <p className="text-xs text-fg-muted">Skipped</p>
            </div>
          </div>
          {result.errors.slice(0, 5).map((e) => (
            <p key={e} className="text-xs text-rose-300">
              {e}
            </p>
          ))}
        </div>
      )}
    </Modal>
  );
};
