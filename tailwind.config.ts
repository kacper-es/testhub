import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    // Paleta zawężona do tokenów — twarde egzekwowanie „zero surowych kolorów".
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      inherit: 'inherit',
      white: '#ffffff',
      black: '#000000',
      bg: 'var(--bg)',
      surface: 'var(--surface)',
      'surface-raised': 'var(--surface-raised)',
      border: 'var(--border)',
      focus: 'var(--focus)',
      fg: 'var(--text)',
      muted: 'var(--text-muted)',
      // wypełnienia / kropki wskaźnika (sekcja 9.1)
      pass: 'var(--status-pass)',
      warn: 'var(--status-warn)',
      fail: 'var(--status-fail)',
      // dostępne warianty tekstowe statusów
      'pass-strong': 'var(--text-pass)',
      'warn-strong': 'var(--text-warn)',
      'fail-strong': 'var(--text-fail)',
    },
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      keyframes: {
        'check-pop': {
          '0%': { transform: 'scale(1)' },
          '45%': { transform: 'scale(1.25)' },
          '100%': { transform: 'scale(1)' },
        },
        'dot-fill': {
          '0%': { transform: 'scale(0.4)', opacity: '0.2' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        'check-pop': 'check-pop 180ms ease-out',
        'dot-fill': 'dot-fill 180ms ease-out both',
      },
    },
  },
  plugins: [],
}

export default config
