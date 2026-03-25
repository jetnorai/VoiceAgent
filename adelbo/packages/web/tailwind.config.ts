import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ─── Adelbo design system ──────────────────────────────────────────
        bg: {
          base: '#060609',
          surface: '#0D0D14',
          elevated: '#14141F',
          border: '#1F1F2E',
        },
        text: {
          primary: '#F5F5F0',
          secondary: '#9CA3AF',
          muted: '#6B7280',
        },
        amber: {
          DEFAULT: '#E8A838',
          light: '#F0BC5A',
          dark: '#C48A28',
        },
        success: '#22C55E',
        violet: '#A78BFA',
        slate: {
          700: '#374151',
          800: '#1F2937',
        },
      },
      fontFamily: {
        display: ['Outfit', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
      },
      borderRadius: {
        card: '16px',
        'card-lg': '24px',
      },
      backgroundImage: {
        'glass': 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
        'amber-glow': 'radial-gradient(ellipse at center, rgba(232,168,56,0.15) 0%, transparent 70%)',
      },
      animation: {
        'fade-up': 'fadeUp 0.4s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'pulse-amber': 'pulseAmber 2s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        pulseAmber: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
