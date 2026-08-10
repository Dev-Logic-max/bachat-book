import React from 'react';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient, persister } from '../lib/query-client';

/**
 * The read cache is the whole point of the offline layer on the read side
 * (MOBILE-PLAN.md §6.3). `createAsyncStoragePersister` was being constructed and
 * then never used — a plain `QueryClientProvider` persists nothing, so a cold
 * start with no connection rendered empty screens.
 *
 * `PersistQueryClientProvider` restores the cache before the first render, which
 * is what makes cached data appear instantly rather than after a fetch round
 * trip. Pakistani mobile data is intermittent; a finance app that shows a
 * spinner on the bus is a deleted app.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        // Must not exceed the client's gcTime or entries are evicted on restore.
        maxAge: 24 * 60 * 60 * 1000,
        // Bump this string whenever a cached query's shape changes, so a stale
        // payload from an older build is discarded instead of rendered.
        buster: 'bachat-v1',
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
