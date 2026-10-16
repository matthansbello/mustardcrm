'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useReducedMotion } from './useReducedMotion';

interface UseGsapRevealOptions {
  stagger?: number;
  duration?: number;
  yOffset?: number;
  selector?: string;
}

/**
 * Subtle entrance: children fade in and rise a few pixels, staggered.
 * Respects prefers-reduced-motion.
 */
export function useGsapReveal<T extends HTMLElement = HTMLDivElement>(options: UseGsapRevealOptions = {}) {
  const containerRef = useRef<T | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const { stagger = 0.04, duration = 0.35, yOffset = 8, selector } = options;

  useEffect(() => {
    if (!containerRef.current || prefersReducedMotion) return;

    const targets = selector
      ? containerRef.current.querySelectorAll(selector)
      : containerRef.current.children;
    if (!targets || targets.length === 0) return;

    // fromTo inside the context so revert() also undoes the hidden starting state.
    const ctx = gsap.context(() => {
      gsap.fromTo(
        targets,
        { opacity: 0, y: yOffset },
        { opacity: 1, y: 0, duration, stagger, ease: 'power2.out', clearProps: 'opacity,transform' }
      );
    }, containerRef);

    return () => ctx.revert();
  }, [stagger, duration, yOffset, selector, prefersReducedMotion]);

  return containerRef;
}
