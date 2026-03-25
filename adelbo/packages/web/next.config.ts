import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.liteapi.travel' },
      { protocol: 'https', hostname: '**.hotelbeds.com' },
      { protocol: 'https', hostname: '**.worldcoin.org' },
    ],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
    NEXT_PUBLIC_WORLD_APP_ID: process.env.NEXT_PUBLIC_WORLD_APP_ID || '',
    NEXT_PUBLIC_STRIPE_PK: process.env.NEXT_PUBLIC_STRIPE_PK || '',
  },
};

export default nextConfig;
