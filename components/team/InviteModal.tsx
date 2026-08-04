'use client';

import React, { useState } from 'react';
import { UserRole, User } from '@/types';
import { useAuthStore } from '@/lib/store/useAuthStore';
import { inviteTeammate } from '@/lib/services/team';
import { X, UserPlus, Mail } from 'lucide-react';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newUser: User) => void;
}

export const InviteModal: React.FC<InviteModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { organization, user } = useAuthStore();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('rep');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !organization?.id || !user?.id) return;

    setIsSending(true);
    setError(null);
    try {
      const { user: newUser } = await inviteTeammate(organization.id, email, role, user.id);
      onSuccess(newUser);
      setEmail('');
      onClose();
    } catch (err) {
      console.error('Error inviting teammate:', err);
      setError(err instanceof Error ? err.message : 'Invite failed');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="w-full max-w-md glass-panel p-6 rounded-3xl border border-white/10 space-y-6 relative">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-white p-1">
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 border-b border-white/10 pb-4">
          <div className="p-2.5 rounded-xl bg-blue-500/15 border border-blue-400/30 text-blue-300">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold font-display text-white">Invite Teammate</h3>
            <p className="text-xs text-dark-muted">Send workspace invitation link to team member</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/30 text-rose-300 text-xs">
              {error}
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-300">Teammate Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jordan@company.com"
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-mustard-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-300">Access Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-mustard-500"
            >
              <option value="rep">Sales Rep (Owns leads & sequences)</option>
              <option value="manager">Manager (Views team performance)</option>
              <option value="admin">Admin (Full workspace control)</option>
            </select>
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="glass-button px-4 py-2 rounded-xl text-xs font-medium text-gray-300">
              Cancel
            </button>
            <button type="submit" disabled={isSending} className="btn-mustard px-5 py-2 rounded-xl text-xs font-semibold disabled:opacity-50">
              {isSending ? 'Sending Invite...' : 'Send Invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
