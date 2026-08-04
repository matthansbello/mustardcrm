'use client';

import React, { useState } from 'react';
import { UserRole } from '@/types';
import { useAuthStore } from '@/lib/store/useAuthStore';
import { bulkInviteTeammates } from '@/lib/services/team';
import { parseImportFile } from '@/lib/importer/parser';
import { X, UploadCloud, Loader2 } from 'lucide-react';

interface BulkInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const BulkInviteModal: React.FC<BulkInviteModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { organization, user } = useAuthStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ invited: number; skipped: number; errors: string[] } | null>(null);

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="w-full max-w-md glass-panel p-6 rounded-3xl border border-white/10 space-y-5 relative">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-white p-1">
          <X className="w-4 h-4" />
        </button>

        <div>
          <h3 className="text-lg font-bold font-display text-white">Bulk Invite Team</h3>
          <p className="text-xs text-dark-muted mt-1">
            CSV/XLSX with columns: email, firstName, lastName, and role (or title as role).
          </p>
        </div>

        <label className="border-2 border-dashed border-white/20 hover:border-mustard-500 rounded-2xl p-8 flex flex-col items-center gap-2 cursor-pointer text-center">
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) handleFile(e.target.files[0]);
            }}
          />
          {isProcessing ? (
            <Loader2 className="w-8 h-8 text-mustard-400 animate-spin" />
          ) : (
            <UploadCloud className="w-8 h-8 text-mustard-400" />
          )}
          <span className="text-xs text-white font-medium">
            {isProcessing ? 'Inviting...' : 'Drop team CSV here'}
          </span>
        </label>

        {result && (
          <div className="text-xs space-y-1 p-3 rounded-xl bg-white/5 border border-white/10">
            <p className="text-emerald-400">Invited: {result.invited}</p>
            <p className="text-amber-400">Skipped: {result.skipped}</p>
            {result.errors.slice(0, 5).map((e) => (
              <p key={e} className="text-rose-300">
                {e}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
