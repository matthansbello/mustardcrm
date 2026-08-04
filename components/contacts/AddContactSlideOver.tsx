'use client';

import React, { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useAuthStore } from '@/lib/store/useAuthStore';
import { checkDuplicateEmail, createContact } from '@/lib/services/contacts';
import { Contact } from '@/types';
import { useReducedMotion } from '@/lib/hooks/useReducedMotion';
import { X, UserPlus, AlertTriangle, Check, Building, Mail, User, Briefcase, Phone, Tag } from 'lucide-react';

interface AddContactSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newContact: Contact) => void;
}

export const AddContactSlideOver: React.FC<AddContactSlideOverProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user, organization } = useAuthStore();
  const prefersReducedMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    title: '',
    companyName: '',
    phone: '',
    tags: 'lead, inbound',
  });

  const [isDuplicate, setIsDuplicate] = useState(false);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (!isOpen || prefersReducedMotion) return;
    const ctx = gsap.context(() => {
      if (backdropRef.current) {
        gsap.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3 });
      }
      if (panelRef.current) {
        gsap.fromTo(
          panelRef.current,
          { x: '100%', filter: 'blur(8px)' },
          { x: '0%', filter: 'blur(0px)', duration: 0.55, ease: 'power4.out', clearProps: 'filter' }
        );
      }
    });
    return () => ctx.revert();
  }, [isOpen, prefersReducedMotion]);

  useEffect(() => {
    if (!formData.email.includes('@')) {
      setIsDuplicate(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsCheckingDuplicate(true);
      const isDup = await checkDuplicateEmail(organization?.id || '', formData.email);
      setIsDuplicate(isDup);
      if (isDup) {
        setShake(true);
        setTimeout(() => setShake(false), 500);
      }
      setIsCheckingDuplicate(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [formData.email, organization?.id]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDuplicate || isSaving || !organization?.id || !user?.id) return;

    setIsSaving(true);
    try {
      const newContact = await createContact(organization.id, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        title: formData.title || undefined,
        companyName: formData.companyName || undefined,
        phone: formData.phone || undefined,
        tags: formData.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        ownerId: user.id,
        lifecycleStage: 'lead',
        customFields: {},
      });
      onSuccess(newContact);
      onClose();
    } catch (err) {
      console.error('Failed to create contact:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end"
    >
      <div
        ref={panelRef}
        className="w-full max-w-md bg-dark-bg/95 border-l border-blue-400/20 h-full p-6 space-y-6 flex flex-col justify-between overflow-y-auto shadow-glow-blue"
      >
        <div>
          <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-500/15 border border-blue-400/30 text-blue-300">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold font-display text-white">Add New Contact</h3>
                <p className="text-xs text-dark-muted">Manual lead entry with real-time deduping</p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form id="add-contact-form" onSubmit={handleSubmit} className="space-y-4">
            <div className={`space-y-1.5 ${shake ? 'animate-pulse' : ''}`}>
              <label className="text-xs font-medium text-gray-300">Email Address *</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={`w-full bg-white/5 border rounded-xl pl-9 pr-4 py-2.5 text-xs text-white focus:outline-none transition-all ${
                    isDuplicate
                      ? 'border-rose-500 ring-2 ring-rose-500/20'
                      : 'border-white/10 focus:border-blue-400'
                  }`}
                  placeholder="alex.smith@company.com"
                />
              </div>
              {isDuplicate && (
                <p className="text-[11px] text-rose-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Duplicate email already exists in workspace
                </p>
              )}
              {isCheckingDuplicate && (
                <p className="text-[11px] text-dark-muted">Checking duplicates...</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-300">First Name *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white focus:outline-none focus:border-blue-400"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-300">Last Name</label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-blue-400"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-300">Company</label>
              <div className="relative">
                <Building className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white focus:outline-none focus:border-blue-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-300">Title</label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white focus:outline-none focus:border-blue-400"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-300">Phone</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white focus:outline-none focus:border-blue-400"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-300">Tags</label>
              <div className="relative">
                <Tag className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white focus:outline-none focus:border-blue-400"
                  placeholder="lead, inbound"
                />
              </div>
            </div>
          </form>
        </div>

        <div className="pt-4 border-t border-white/10 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="glass-button flex-1 py-2.5 rounded-xl text-xs font-medium text-gray-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="add-contact-form"
            disabled={isDuplicate || isSaving}
            className="btn-mustard flex-1 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5" />
            {isSaving ? 'Saving...' : 'Save Contact'}
          </button>
        </div>
      </div>
    </div>
  );
};
