'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useModalReveal } from '@/lib/hooks/useModalReveal';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  /** Buttons for the footer, right-aligned. */
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Slide in from the right as a full-height panel. */
  variant?: 'center' | 'right';
  /** Prevent closing (e.g. while saving). */
  locked?: boolean;
}

const SIZES = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl' };

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'sm',
  variant = 'center',
  locked = false,
}: ModalProps) {
  const { panelRef, backdropRef } = useModalReveal(isOpen, variant);

  // Stop the page behind from scrolling (especially on iOS) while open.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !locked) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, locked, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  const right = variant === 'right';

  // Portal to <body> so parent layout (e.g. space-y-* margins, transforms) can't offset the overlay.
  return createPortal(
    <div
      ref={backdropRef}
      className={`fixed inset-0 z-[60] flex bg-black/60 ${
        right ? 'justify-end' : 'items-end justify-center sm:items-center sm:p-4'
      }`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !locked) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex flex-col bg-surface border-line shadow-popover ${
          right
            ? 'h-[100dvh] w-full max-w-md border-l'
            : `w-full ${SIZES[size]} max-h-[92dvh] rounded-t-xl border-x border-t sm:max-h-[90dvh] sm:rounded-xl sm:border`
        }`}
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4 border-b border-line">
          <div className="min-w-0">
            <h2 className="text-base font-semibold font-sans tracking-normal text-fg">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={locked}
            aria-label="Close"
            className="btn btn-ghost btn-icon btn-sm -mr-1.5 -mt-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
