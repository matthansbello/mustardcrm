'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useReducedMotion } from './useReducedMotion';

interface UseGsapRevealOptions {
  stagger?: number;
  duration?: number;
  delay?: number;
  yOffset?: number;
  scaleFrom?: number;
  blurFrom?: number;
  rotateFrom?: number;
  selector?: string;
  aggressive?: boolean;
}

/**
 * Aggressive entrance reveal — blur + scale + rise with elastic-ish easing.
 * Respects prefers-reduced-motion.
 */
export function useGsapReveal<T extends HTMLElement = HTMLDivElement>(
  options: UseGsapRevealOptions = {}
) {
  const containerRef = useRef<T | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const aggressive = options.aggressive !== false;
  const {
    stagger = aggressive ? 0.1 : 0.06,
    duration = aggressive ? 0.95 : 0.6,
    delay = aggressive ? 0.08 : 0.05,
    yOffset = aggressive ? 56 : 20,
    scaleFrom = aggressive ? 0.88 : 0.96,
    blurFrom = aggressive ? 14 : 0,
    rotateFrom = aggressive ? 1.5 : 0,
    selector,
  } = options;

  useEffect(() => {
    if (!containerRef.current) return;

    const targets = selector
      ? containerRef.current.querySelectorAll(selector)
      : containerRef.current.children;

    if (!targets || targets.length === 0) return;

    if (prefersReducedMotion) {
      gsap.set(targets, { opacity: 1, y: 0, scale: 1, rotate: 0, filter: 'blur(0px)' });
      return;
    }

    gsap.set(targets, {
      opacity: 0,
      y: yOffset,
      scale: scaleFrom,
      rotate: rotateFrom,
      filter: blurFrom > 0 ? `blur(${blurFrom}px)` : 'none',
      transformOrigin: '50% 80%',
    });

    const ctx = gsap.context(() => {
      gsap.to(targets, {
        opacity: 1,
        y: 0,
        scale: 1,
        rotate: 0,
        filter: 'blur(0px)',
        duration,
        delay,
        stagger: {
          each: stagger,
          from: 'start',
          ease: 'power2.out',
        },
        ease: 'power4.out',
        clearProps: 'filter,transform',
      });
    }, containerRef);

    return () => ctx.revert();
  }, [
    stagger,
    duration,
    delay,
    yOffset,
    scaleFrom,
    blurFrom,
    rotateFrom,
    selector,
    prefersReducedMotion,
  ]);

  return containerRef;
}
