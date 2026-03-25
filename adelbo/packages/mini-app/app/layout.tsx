import type { Metadata } from 'next';
import './globals.css';
import { MiniAppProviders } from './providers';
import { BottomNav } from '@/src/components/BottomNav';

export const metadata: Metadata = {
  title: 'Adelbo',
  description: 'Smarter stays start here. AI hotel booking with Travel Credit.',
  themeColor: '#060609',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg-base antialiased overflow-x-hidden">
        <MiniAppProviders>
          <div className="relative min-h-screen">
            {children}
            <BottomNav />
          </div>
        </MiniAppProviders>
      </body>
    </html>
  );
}
