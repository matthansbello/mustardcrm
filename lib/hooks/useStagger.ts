'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useReducedMotion } from './useReducedMotion';

interface UseStaggerOptions {
  stagger?: number;
  duration?: number;
  yOffset?: number;
  scaleFrom?: number;
  deps?: unknown[];
}

/**
 * Aggressive list stagger — used when data loads / filters change.
 */
export function useStagger<T extends HTMLElement = HTMLDivElement>(
  options: UseStaggerOptions = {}
) {
  const containerRef = useRef<T | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const {
    stagger = 0.07,
    duration = 0.7,
    yOffset = 28,
    scaleFrom = 0.92,
    deps = [],
  } = options;

  useEffect(() => {
    if (!containerRef.current) return;
    const targets = containerRef.current.children;
    if (!targets.length) return;

    if (prefersReducedMotion) {
      gsap.set(targets, { opacity: 1, y: 0, scale: 1 });
      return;
    }

    gsap.fromTo(
      targets,
      {
        opacity: 0,
        y: yOffset,
        scale: scaleFrom,
        filter: 'blur(8px)',
      },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        filter: 'blur(0px)',
        duration,
        stagger: {
          each: stagger,
          from: 'start',
        },
        ease: 'back.out(1.4)',
        clearProps: 'filter,transform',
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefersReducedMotion, stagger, duration, yOffset, scaleFrom, ...deps]);

  return containerRef;
}
