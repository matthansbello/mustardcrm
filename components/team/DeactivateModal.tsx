'use client';

import React, { useState } from 'react';
import { User } from '@/types';
import { useAuthStore } from '@/lib/store/useAuthStore';
import { deactivateTeammate } from '@/lib/services/team';
import { X, UserX, AlertTriangle, ArrowRight } from 'lucide-react';

interface DeactivateModalProps {
  teammate: User | null;
  allTeammates: User[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (deactivatedId: string) => void;
}

export const DeactivateModal: React.FC<DeactivateModalProps> = ({
  teammate,
  allTeammates,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { organization } = useAuthStore();
  const [reassignedOwnerId, setReassignedOwnerId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen || !teammate) return null;

  const eligibleOwners = allTeammates.filter((u) => u.id !== teammate.id);

  const handleDeactivate = async () => {
    if (!reassignedOwnerId) return;

    setIsProcessing(true);
    try {
      await deactivateTeammate(organization?.id || 'demo-org-1', teammate.id, reassignedOwnerId);
      onSuccess(teammate.id);
      onClose();
    } catch (err) {
      console.error('Error deactivating teammate:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="w-full max-w-md glass-panel p-6 rounded-3xl border border-white/10 space-y-6 relative">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-white p-1">
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 border-b border-white/10 pb-4">
          <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-500/30 text-rose-400">
            <UserX className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold font-display text-white">Deactivate Teammate</h3>
            <p className="text-xs text-dark-muted">Reassign contacts and deals for {teammate.displayName}</p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <p>
            Deactivating will revoke inbox access for <span className="font-bold text-white">{teammate.email}</span>. You must select a team member to take over their assigned contacts and pipeline deals.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-300">Reassign Contacts & Deals To *</label>
          <select
            value={reassignedOwnerId}
            onChange={(e) => setReassignedOwnerId(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-mustard-500"
          >
            <option value="">-- Select Teammate --</option>
            {eligibleOwners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.displayName} ({o.email})
              </option>
            ))}
          </select>
        </div>

        <div className="pt-2 flex justify-end gap-3">
          <button onClick={onClose} className="glass-button px-4 py-2 rounded-xl text-xs font-medium text-gray-300">
            Cancel
          </button>
          <button
            onClick={handleDeactivate}
            disabled={!reassignedOwnerId || isProcessing}
            className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            <span>{isProcessing ? 'Reassigning & Deactivating...' : 'Reassign & Deactivate'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
