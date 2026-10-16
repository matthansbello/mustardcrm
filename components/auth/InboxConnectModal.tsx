'use client';

import React, { useState } from 'react';
import { CircleAlert, Send, MailSearch } from 'lucide-react';
import { startGmailConnect } from '@/lib/firebase/auth';
import { Modal } from '@/components/ui/Modal';

interface InboxConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InboxConnectModal: React.FC<InboxConnectModalProps> = ({ isOpen, onClose }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuthorize = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      await startGmailConnect('/settings?gmail=connected');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to connect Gmail inbox');
      setIsConnecting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Connect Gmail"
      description="Send sequences from your own Gmail or Google Workspace address."
      locked={isConnecting}
      footer={
        <>
          <button onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button onClick={handleAuthorize} disabled={isConnecting} className="btn btn-primary">
            {isConnecting ? 'Redirecting to Google…' : 'Continue with Google'}
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
      <p className="text-sm text-fg-muted">Google will ask you to allow two permissions:</p>
      <ul className="mt-3 space-y-3">
        <li className="flex gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line bg-surface-2">
            <Send className="h-4 w-4 text-fg-muted" strokeWidth={1.75} />
          </span>
          <div>
            <p className="text-sm font-medium text-fg">Send email on your behalf</p>
            <p className="text-xs text-fg-muted">Only the sequence emails you schedule.</p>
          </div>
        </li>
        <li className="flex gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line bg-surface-2">
            <MailSearch className="h-4 w-4 text-fg-muted" strokeWidth={1.75} />
          </span>
          <div>
            <p className="text-sm font-medium text-fg">Detect replies</p>
            <p className="text-xs text-fg-muted">Reads message headers only, so sequences stop when someone replies.</p>
          </div>
        </li>
      </ul>
    </Modal>
  );
};
