import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.liteapi.travel' },
      { protocol: 'https', hostname: '**.hotelbeds.com' },
    ],
  },
  // Mini app must be served within 480px max-width (World App webview)
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
    NEXT_PUBLIC_WORLD_APP_ID: process.env.NEXT_PUBLIC_WORLD_APP_ID || '',
  },
};

export default nextConfig;
