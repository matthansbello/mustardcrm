'use client';

import React, { useState } from 'react';
import { useAuthStore } from '@/lib/store/useAuthStore';
import { Chrome, Mail, X, AlertCircle } from 'lucide-react';

interface InboxConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InboxConnectModal: React.FC<InboxConnectModalProps> = ({ isOpen, onClose }) => {
  const { user, organization, setInboxStatus } = useAuthStore();
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAuthorize = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      if (!user?.id || !organization?.id) {
        throw new Error('Please sign in to your workspace before connecting Gmail.');
      }

      // Fetch Google OAuth consent URL from server
      const res = await fetch(`/api/auth/google?userId=${user.id}&orgId=${organization.id}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to initialize Google OAuth flow.');
      }

      if (data.url) {
        // Redirect to real Google Workspace OAuth consent screen
        window.location.href = data.url;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect Gmail inbox');
      setIsConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <div className="w-full max-w-md glass-panel p-6 rounded-3xl border border-white/10 space-y-6 relative">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-white p-1">
          <X className="w-4 h-4" />
        </button>

        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-400 via-blue-600 to-cyan-400 flex items-center justify-center mx-auto shadow-glow-blue mb-2">
            <Mail className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-xl font-bold font-display text-white">Connect Gmail Inbox</h3>
          <p className="text-xs text-dark-muted">
            Authorize Mustard to send cold email sequences from this Gmail inbox (personal or Workspace).
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2 text-xs text-gray-300">
          <p className="font-semibold text-white">Required Permissions:</p>
          <ul className="space-y-1 text-dark-muted list-disc list-inside">
            <li>`gmail.send` — Send outreach mail as rep</li>
            <li>`gmail.readonly` — Detect prospect replies</li>
          </ul>
        </div>

        <button
          onClick={handleAuthorize}
          disabled={isConnecting}
          className="w-full py-3.5 px-4 rounded-xl btn-mustard text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-glow-blue disabled:opacity-50"
        >
          <Chrome className="w-4 h-4" />
          <span>{isConnecting ? 'Redirecting to Google...' : 'Authorize Gmail Connection'}</span>
        </button>
      </div>
    </div>
  );
};
