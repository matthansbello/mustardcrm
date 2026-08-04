import type { Config } from 'tailwindcss';

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
        // Brand accent tokens (blue spectrum — class names kept for compatibility)
        mustard: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          accent: '#38bdf8',
        },
        violet: {
          accent: '#818cf8',
          electric: '#22d3ee',
        },
        dark: {
          bg: '#05070f',
          card: '#0a1020',
          elevated: '#111827',
          border: '#1e293b',
          muted: '#94a3b8',
        },
      },
      backgroundImage: {
        'mustard-gradient': 'linear-gradient(135deg, #3b82f6 0%, #22d3ee 50%, #6366f1 100%)',
        'blue-radial':
          'radial-gradient(circle at center, rgba(59, 130, 246, 0.2) 0%, rgba(34, 211, 238, 0.08) 40%, transparent 70%)',
        'radial-glow':
          'radial-gradient(circle at center, rgba(59, 130, 246, 0.18) 0%, rgba(99, 102, 241, 0.06) 50%, transparent 100%)',
        'glass-gradient':
          'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(59, 130, 246, 0.04) 50%, rgba(255, 255, 255, 0.02) 100%)',
      },
      boxShadow: {
        'glow-mustard': '0 0 28px -4px rgba(59, 130, 246, 0.45)',
        'glow-violet': '0 0 28px -4px rgba(34, 211, 238, 0.35)',
        'glow-blue': '0 0 40px -6px rgba(59, 130, 246, 0.55)',
        glass: '0 8px 40px 0 rgba(2, 6, 23, 0.55)',
      },
      fontFamily: {
        sans: ['var(--font-bricolage)', 'sans-serif'],
        display: ['var(--font-bricolage)', 'sans-serif'],
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { opacity: '0.45', transform: 'scale(1)' },
          '50%': { opacity: '0.85', transform: 'scale(1.05)' },
        },
        'float-orb': {
          '0%, 100%': { transform: 'translateY(0px) translateX(0px)' },
          '50%': { transform: 'translateY(-24px) translateX(12px)' },
        },
      },
      animation: {
        'glow-pulse': 'glow-pulse 3.5s ease-in-out infinite',
        'float-orb': 'float-orb 8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
