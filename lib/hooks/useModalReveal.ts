'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useReducedMotion } from './useReducedMotion';

/**
 * Aggressive modal / slide-over entrance (scale + blur + rise).
 */
export function useModalReveal(isOpen: boolean) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!isOpen || prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      if (backdropRef.current) {
        gsap.fromTo(
          backdropRef.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.35, ease: 'power2.out' }
        );
      }
      if (panelRef.current) {
        gsap.fromTo(
          panelRef.current,
          { opacity: 0, y: 40, scale: 0.92, filter: 'blur(12px)' },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            filter: 'blur(0px)',
            duration: 0.55,
            ease: 'power4.out',
            clearProps: 'filter',
          }
        );
      }
    });

    return () => ctx.revert();
  }, [isOpen, prefersReducedMotion]);

  return { panelRef, backdropRef };
}
