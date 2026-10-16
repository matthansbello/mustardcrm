'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { usePathname } from 'next/navigation';
import { useReducedMotion } from './useReducedMotion';

/** Quick fade when the route changes. */
export function usePageTransition<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!ref.current || prefersReducedMotion) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(ref.current, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'power1.out', clearProps: 'opacity' });
    }, ref);
    return () => ctx.revert();
  }, [pathname, prefersReducedMotion]);

  return ref;
}
