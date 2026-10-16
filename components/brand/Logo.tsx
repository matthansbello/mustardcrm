import React from 'react';

/**
 * Mustard brand mark, traced from the 1080×1080 master artwork
 * (public/brand/mustard-logo.png). Three bars: bottom-left curve,
 * round-bottomed centre bar, top-right curve.
 */
export const LOGO_PATHS = [
  'M59 79H329V1000A270 270 0 0 1 59 730Z',
  'M405 79H675V865A135 135 0 0 1 405 865Z',
  'M751 79A270 270 0 0 1 1021 349V1000H751Z',
];

export const LOGO_VIEWBOX = '59 79 962 921';

const GRADIENT_ID = 'mustard-logo-gradient';

interface LogoMarkProps {
  /** Rendered height in px; width follows the mark's aspect ratio. */
  size?: number;
  className?: string;
  title?: string;
}

export function LogoMark({ size = 28, className = '', title = 'Mustard' }: LogoMarkProps) {
  return (
    <svg
      viewBox={LOGO_VIEWBOX}
      height={size}
      width={Math.round((size * 962) / 921)}
      className={`shrink-0 ${className}`}
      role="img"
      aria-label={title}
    >
      <defs>
        <linearGradient id={GRADIENT_ID} gradientUnits="userSpaceOnUse" x1="250" y1="950" x2="900" y2="250">
          <stop offset="0" stopColor="#3459fc" />
          <stop offset="0.5" stopColor="#4f9afa" />
          <stop offset="1" stopColor="#63c3f8" />
        </linearGradient>
      </defs>
      {LOGO_PATHS.map((d) => (
        <path key={d} d={d} fill={`url(#${GRADIENT_ID})`} />
      ))}
    </svg>
  );
}

interface LogoProps extends LogoMarkProps {
  /** Hide the "Mustard" wordmark (e.g. very narrow spaces). */
  markOnly?: boolean;
  textClassName?: string;
}

/** Mark + wordmark lockup. */
export function Logo({ size = 24, markOnly = false, className = '', textClassName = '' }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} title={markOnly ? 'Mustard' : ''} />
      {!markOnly && (
        <span className={`font-display font-semibold tracking-tight text-fg ${textClassName}`}>Mustard</span>
      )}
    </span>
  );
}
