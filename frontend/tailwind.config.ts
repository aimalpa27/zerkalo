import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './admin.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:    'var(--color-bg)',
        card:  'var(--color-card)',
        card2: 'var(--color-card2)',
        card3: 'var(--color-card2)',
        rim:   'var(--color-rim)',
        gold:  'var(--color-gold)',
        gold2: 'var(--color-gold2)',
        dim:   'var(--color-dim)',
        mid:   'var(--color-mid)',
        soft:  'var(--color-soft)',
        green: 'var(--color-green)',
        red:   'var(--color-red)',
      },
      fontFamily: {
        sans:    ['Manrope', 'system-ui', 'sans-serif'],
        display: ['Manrope', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, var(--color-gold) 0%, var(--color-gold2) 50%, var(--color-gold) 100%)',
        'card-gradient': 'linear-gradient(180deg, var(--color-card) 0%, var(--color-bg) 100%)',
        'hero-gradient': 'linear-gradient(180deg, transparent 0%, var(--color-bg) 100%)',
      },
      boxShadow: {
        'gold':  '0 0 40px rgba(255,107,26,0.18)',
        'card':  '0 8px 32px rgba(0,0,0,0.4)',
        'deep':  '0 16px 48px rgba(0,0,0,0.6)',
      },
      animation: {
        'slide-up':   'slideUp 0.4s cubic-bezier(0.32,1.2,0.5,1)',
        'fade-in':    'fadeIn 0.3s ease',
        'pulse-gold': 'pulseGold 2s ease infinite',
      },
      keyframes: {
        slideUp:    { from: { transform: 'translateY(20px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        fadeIn:     { from: { opacity: '0' }, to: { opacity: '1' } },
        pulseGold:  { '0%,100%': { boxShadow: '0 0 0 0 rgba(255,107,26,0.4)' }, '50%': { boxShadow: '0 0 0 8px rgba(255,107,26,0)' } },
      },
    },
  },
  plugins: [],
} satisfies Config