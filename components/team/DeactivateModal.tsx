'use client';

import React, { useState } from 'react';
import { CircleAlert } from 'lucide-react';
import { User } from '@/types';
import { useAuthStore } from '@/lib/store/useAuthStore';
import { deactivateTeammate } from '@/lib/services/team';
import { Modal } from '@/components/ui/Modal';

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
  const [reassignTo, setReassignTo] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!teammate) return null;

  const eligibleOwners = allTeammates.filter((u) => u.id !== teammate.id && u.status !== 'invited');

  const close = () => {
    setError(null);
    setReassignTo('');
    onClose();
  };

  const handleDeactivate = async () => {
    if (!reassignTo || !organization?.id) return;
    setIsProcessing(true);
    setError(null);
    try {
      await deactivateTeammate(organization.id, teammate.id, reassignTo);
      onSuccess(teammate.id);
      close();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not deactivate';
      setError(/permission/i.test(message) ? 'Only admins and managers can deactivate teammates.' : message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      locked={isProcessing}
      title={`Deactivate ${teammate.displayName || teammate.email}?`}
      description="They’ll lose access immediately and their Gmail will stop sending."
      footer={
        <>
          <button onClick={close} className="btn btn-secondary">
            Cancel
          </button>
          <button onClick={handleDeactivate} disabled={!reassignTo || isProcessing} className="btn btn-danger">
            {isProcessing ? 'Deactivating…' : 'Deactivate'}
          </button>
        </>
      }
    >
      {error && (
        <div className="alert alert-error mb-4">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <label htmlFor="reassign" className="label">
        Give their contacts and deals to
      </label>
      <select id="reassign" value={reassignTo} onChange={(e) => setReassignTo(e.target.value)} className="input">
        <option value="">Choose a teammate…</option>
        {eligibleOwners.map((o) => (
          <option key={o.id} value={o.id}>
            {o.displayName} ({o.email})
          </option>
        ))}
      </select>
      <p className="hint">Everything they own moves to this person. Shared workspace data stays visible to everyone.</p>
    </Modal>
  );
};
