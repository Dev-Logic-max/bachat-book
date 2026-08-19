import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  discardFailed,
  enqueueAction,
  generateClientUuid,
  getFailedRows,
  getOutboxStatus,
  replayOutbox,
  retryFailed,
  setupOutboxListeners,
  type OutboxRow,
} from '../lib/outbox';

export function useOfflineQueue() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState(() => getOutboxStatus());
  const [failedRows, setFailedRows] = useState<OutboxRow[]>([]);

  const refresh = useCallback(() => {
    setStatus(getOutboxStatus());
    setFailedRows(getFailedRows());
  }, []);

  useEffect(() => {
    // Drains on reconnect AND on app foreground. NetInfo alone misses the
    // connection returning while the phone is in a pocket, because Android
    // freezes a backgrounded app's JS thread.
    const unsubscribe = setupOutboxListeners();

    // The outbox is SQLite, not React state, so nothing notifies us when a
    // background drain empties it. Polling is the honest mechanism; three
    // seconds is well under the time it takes to notice a stale badge.
    const interval = setInterval(refresh, 3000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [refresh]);

  const drain = useCallback(async () => {
    const result = await replayOutbox();
    refresh();
    // Whatever landed changed the server's numbers, so the cached reads that
    // were rendered from the optimistic copies have to be re-fetched.
    if (result.processed > 0) {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    }
    return result;
  }, [queryClient, refresh]);

  const retry = useCallback(
    (id?: string) => {
      retryFailed(id);
      refresh();
    },
    [refresh],
  );

  const discard = useCallback(
    (id: string) => {
      discardFailed(id);
      refresh();
    },
    [refresh],
  );

  return {
    pendingCount: status.pending,
    failedCount: status.failed,
    failedRows,
    drain,
    retry,
    discard,
    refresh,
    enqueueAction,
    generateClientUuid,
    /** @deprecated Use `drain`, which also refreshes the cached reads. */
    replayOutbox: drain,
  };
}
