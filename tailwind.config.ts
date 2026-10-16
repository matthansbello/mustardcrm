import type { Config } from 'tailwindcss';

/**
 * Flat design tokens — solid surfaces, one accent colour, no gradients.
 * Use these (canvas / surface / line / fg / accent) for all new UI.
 */
const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#0b0d12',
        surface: {
          DEFAULT: '#111419',
          2: '#171a21',
          3: '#1e222b',
        },
        line: {
          DEFAULT: '#242833',
          strong: '#333948',
        },
        fg: {
          DEFAULT: '#e8eaef',
          muted: '#969dae',
          subtle: '#6b7283',
        },
        accent: {
          DEFAULT: '#3b82f6',
          hover: '#2f6fe0',
          soft: 'rgba(59, 130, 246, 0.12)',
          fg: '#7cb0ff',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['var(--font-bricolage)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      boxShadow: {
        popover: '0 12px 32px -8px rgba(0, 0, 0, 0.6)',
      },
    },
  },
  plugins: [],
};

export default config;
