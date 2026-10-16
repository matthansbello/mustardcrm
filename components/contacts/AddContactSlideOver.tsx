'use client';

import React, { useEffect, useState } from 'react';
import { CircleAlert } from 'lucide-react';
import { useAuthStore } from '@/lib/store/useAuthStore';
import { checkDuplicateEmail, createContact } from '@/lib/services/contacts';
import { Contact } from '@/types';
import { Modal } from '@/components/ui/Modal';

interface AddContactSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newContact: Contact) => void;
}

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  title: '',
  companyName: '',
  phone: '',
  tags: '',
};

export const AddContactSlideOver: React.FC<AddContactSlideOverProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user, organization } = useAuthStore();

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const set = (key: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormData((f) => ({ ...f, [key]: e.target.value }));

  useEffect(() => {
    if (!formData.email.includes('@') || !organization?.id) {
      setIsDuplicate(false);
      return;
    }
    const timer = setTimeout(async () => {
      setIsCheckingDuplicate(true);
      setIsDuplicate(await checkDuplicateEmail(organization.id, formData.email));
      setIsCheckingDuplicate(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [formData.email, organization?.id]);

  const handleClose = () => {
    setSaveError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDuplicate || isSaving) return;
    if (!organization?.id || !user?.id) {
      setSaveError('Your session is still loading — wait a moment and try again.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      // Re-check at save time in case the debounced check hasn't run yet.
      if (await checkDuplicateEmail(organization.id, formData.email)) {
        setIsDuplicate(true);
        return;
      }
      const newContact = await createContact(organization.id, {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email,
        title: formData.title.trim() || undefined,
        companyName: formData.companyName.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        tags: formData.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        ownerId: user.id,
        lifecycleStage: 'lead',
        customFields: {},
      });
      setFormData(EMPTY_FORM);
      onSuccess(newContact);
      handleClose();
    } catch (err) {
      console.error('Failed to create contact:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      setSaveError(
        /permission/i.test(message)
          ? 'You do not have permission to add contacts. Sign out and back in, then try again.'
          : `Could not save contact: ${message}`
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      variant="right"
      title="Add contact"
      description="Everyone in the workspace will be able to see this contact."
      locked={isSaving}
      footer={
        <>
          <button type="button" onClick={handleClose} className="btn btn-secondary">
            Cancel
          </button>
          <button type="submit" form="add-contact-form" disabled={isDuplicate || isSaving} className="btn btn-primary">
            {isSaving ? 'Saving…' : 'Save contact'}
          </button>
        </>
      }
    >
      {saveError && (
        <div className="alert alert-error mb-5">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      <form id="add-contact-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="ac-email" className="label">
            Email <span className="text-rose-400">*</span>
          </label>
          <input
            id="ac-email"
            type="email"
            required
            autoFocus
            value={formData.email}
            onChange={set('email')}
            placeholder="alex@company.com"
            aria-invalid={isDuplicate}
            className={`input ${isDuplicate ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : ''}`}
          />
          {isDuplicate ? (
            <p className="hint flex items-center gap-1 text-rose-300">
              <CircleAlert className="h-3.5 w-3.5" /> A contact with this email already exists.
            </p>
          ) : isCheckingDuplicate ? (
            <p className="hint">Checking for duplicates…</p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="ac-first" className="label">
              First name <span className="text-rose-400">*</span>
            </label>
            <input id="ac-first" type="text" required value={formData.firstName} onChange={set('firstName')} className="input" />
          </div>
          <div>
            <label htmlFor="ac-last" className="label">
              Last name
            </label>
            <input id="ac-last" type="text" value={formData.lastName} onChange={set('lastName')} className="input" />
          </div>
        </div>

        <div>
          <label htmlFor="ac-company" className="label">
            Company
          </label>
          <input id="ac-company" type="text" value={formData.companyName} onChange={set('companyName')} className="input" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="ac-title" className="label">
              Job title
            </label>
            <input id="ac-title" type="text" value={formData.title} onChange={set('title')} className="input" />
          </div>
          <div>
            <label htmlFor="ac-phone" className="label">
              Phone
            </label>
            <input id="ac-phone" type="tel" value={formData.phone} onChange={set('phone')} className="input" />
          </div>
        </div>

        <div>
          <label htmlFor="ac-tags" className="label">
            Tags
          </label>
          <input
            id="ac-tags"
            type="text"
            value={formData.tags}
            onChange={set('tags')}
            placeholder="e.g. inbound, conference"
            className="input"
          />
          <p className="hint">Separate tags with commas.</p>
        </div>
      </form>
    </Modal>
  );
};
