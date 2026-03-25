'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useEffect, useState } from 'react';
import { MiniKit } from '@worldcoin/minikit-js';

export function MiniAppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60 * 1000, retry: 1 },
        },
      })
  );

  useEffect(() => {
    // Initialize MiniKit when running inside World App
    MiniKit.install(process.env.NEXT_PUBLIC_WORLD_APP_ID);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: '#0D0D14',
            color: '#F5F5F0',
            border: '1px solid #1F1F2E',
            borderRadius: '12px',
            fontSize: '14px',
            maxWidth: '340px',
          },
        }}
      />
    </QueryClientProvider>
  );
}
