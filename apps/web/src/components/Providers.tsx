'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpLink } from '@trpc/client';
import { trpc } from '@/src/lib/trpc';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 0, // No caching for real-time polling
            gcTime: 0, // Don't cache results (renamed from cacheTime in v5)
            refetchOnWindowFocus: false,
            retry: false, // Don't retry failed requests during polling
          },
        },
      })
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpLink({
          url: API_URL,
          headers: () => ({
            'Content-Type': 'application/json',
          }),
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
