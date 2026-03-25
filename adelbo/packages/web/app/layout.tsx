import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Adelbo — Smarter stays start here',
  description:
    'AI-assisted hotel booking with real Travel Credit and community rewards. Book smarter, earn meaningfully, stay in the loop.',
  keywords: 'hotel booking, travel, AI, rewards, travel credit',
  openGraph: {
    title: 'Adelbo — Smarter stays start here',
    description: 'Book hotels with better judgment, earn Travel Credit, and unlock community rewards with every stay.',
    type: 'website',
    url: 'https://adelbo.com',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Adelbo — Smarter stays start here',
    description: 'Book hotels with better judgment, earn Travel Credit, and unlock community rewards.',
  },
  themeColor: '#060609',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-bg-base antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
