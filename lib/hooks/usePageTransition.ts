'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { usePathname } from 'next/navigation';
import { useReducedMotion } from './useReducedMotion';

/**
 * Aggressive page enter — blur wipe + rise when route changes.
 */
export function usePageTransition<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!ref.current || prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ref.current,
        {
          opacity: 0,
          y: 32,
          filter: 'blur(12px)',
          scale: 0.98,
        },
        {
          opacity: 1,
          y: 0,
          filter: 'blur(0px)',
          scale: 1,
          duration: 0.75,
          ease: 'power4.out',
          clearProps: 'filter,transform',
        }
      );
    }, ref);

    return () => ctx.revert();
  }, [pathname, prefersReducedMotion]);

  return ref;
}
