'use client';

import React, { useState } from 'react';
import { CircleAlert } from 'lucide-react';
import { UserRole, User } from '@/types';
import { useAuthStore } from '@/lib/store/useAuthStore';
import { inviteTeammate } from '@/lib/services/team';
import { Modal } from '@/components/ui/Modal';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newUser: User) => void;
}

const ROLES: { value: UserRole; label: string; help: string }[] = [
  { value: 'rep', label: 'Rep', help: 'Works contacts, deals and sequences.' },
  { value: 'manager', label: 'Manager', help: 'Everything a rep can do, plus managing teammates.' },
  { value: 'admin', label: 'Admin', help: 'Full control, including workspace settings.' },
];

export const InviteModal: React.FC<InviteModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { organization, user } = useAuthStore();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('rep');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !organization?.id || !user?.id) return;
    setIsSending(true);
    setError(null);
    try {
      const { user: newUser } = await inviteTeammate(organization.id, email, role, user.id);
      onSuccess(newUser);
      setEmail('');
      setRole('rep');
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invite failed');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      locked={isSending}
      title="Invite teammate"
      description="They’ll join this workspace the first time they sign in with this email."
      footer={
        <>
          <button type="button" onClick={close} className="btn btn-secondary">
            Cancel
          </button>
          <button type="submit" form="invite-form" disabled={isSending} className="btn btn-primary">
            {isSending ? 'Inviting…' : 'Send invite'}
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
      <form id="invite-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="invite-email" className="label">
            Email
          </label>
          <input
            id="invite-email"
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jordan@company.com"
            className="input"
          />
        </div>
        <fieldset>
          <legend className="label">Role</legend>
          <div className="space-y-2">
            {ROLES.filter((r) => r.value !== 'admin' || user?.role === 'admin').map((r) => (
              <label
                key={r.value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  role === r.value ? 'border-accent bg-accent-soft' : 'border-line hover:border-line-strong'
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={r.value}
                  checked={role === r.value}
                  onChange={() => setRole(r.value)}
                  className="mt-0.5 accent-[#3b82f6]"
                />
                <span>
                  <span className="block text-sm font-medium text-fg">{r.label}</span>
                  <span className="block text-xs text-fg-muted">{r.help}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </form>
    </Modal>
  );
};
