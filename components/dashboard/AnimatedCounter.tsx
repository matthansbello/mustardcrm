'use client';

import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useReducedMotion } from '@/lib/hooks/useReducedMotion';

interface AnimatedCounterProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  duration = 1.6,
  className = '',
}) => {
  const [displayValue, setDisplayValue] = useState<number>(0);
  const prefersReducedMotion = useReducedMotion();
  const counterObj = useRef({ val: 0 });
  const spanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplayValue(value);
      return;
    }

    counterObj.current.val = 0;
    const ctx = gsap.context(() => {
      gsap.to(counterObj.current, {
        val: value,
        duration,
        ease: 'power4.out',
        onUpdate: () => {
          setDisplayValue(counterObj.current.val);
        },
      });

      if (spanRef.current) {
        gsap.fromTo(
          spanRef.current,
          { scale: 0.85, filter: 'blur(6px)', opacity: 0.4 },
          {
            scale: 1,
            filter: 'blur(0px)',
            opacity: 1,
            duration: duration * 0.7,
            ease: 'back.out(1.6)',
          }
        );
      }
    });

    return () => ctx.revert();
  }, [value, duration, prefersReducedMotion]);

  const formatted = displayValue.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span ref={spanRef} className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
};
