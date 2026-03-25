'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#0D0D14',
            color: '#F5F5F0',
            border: '1px solid #1F1F2E',
            borderRadius: '12px',
            fontSize: '14px',
          },
          success: {
            iconTheme: { primary: '#22C55E', secondary: '#0D0D14' },
          },
          error: {
            iconTheme: { primary: '#EF4444', secondary: '#0D0D14' },
          },
        }}
      />
    </QueryClientProvider>
  );
}
