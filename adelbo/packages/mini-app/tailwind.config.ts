import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
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
      },
      fontFamily: {
        display: ['Outfit', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
      },
      maxWidth: {
        'miniapp': '480px',
      },
    },
  },
  plugins: [],
};

export default config;
