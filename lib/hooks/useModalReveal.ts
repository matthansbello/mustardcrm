'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useReducedMotion } from './useReducedMotion';

/** Modal / slide-over entrance: backdrop fade + panel fade with a slight lift. */
export function useModalReveal(isOpen: boolean, variant: 'center' | 'right' = 'center') {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!isOpen || prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      if (backdropRef.current) {
        gsap.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: 0.18, ease: 'power1.out' });
      }
      if (panelRef.current) {
        gsap.fromTo(
          panelRef.current,
          variant === 'right' ? { opacity: 0, x: 24 } : { opacity: 0, y: 8, scale: 0.99 },
          { opacity: 1, x: 0, y: 0, scale: 1, duration: 0.22, ease: 'power2.out', clearProps: 'transform,opacity' }
        );
      }
    });

    return () => ctx.revert();
  }, [isOpen, prefersReducedMotion, variant]);

  return { panelRef, backdropRef };
}
