import { useEffect, useState } from 'react';
import {
  enqueueAction,
  getOutboxStatus,
  replayOutbox,
  setupOutboxNetInfoListener,
  generateClientUuid,
} from '../lib/outbox';

export function useOfflineQueue() {
  const [status, setStatus] = useState(getOutboxStatus());

  useEffect(() => {
    // 1. Initial NetInfo listener
    const unsubscribe = setupOutboxNetInfoListener();

    // 2. Interval polling for queue counts
    const interval = setInterval(() => {
      setStatus(getOutboxStatus());
    }, 3000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const refreshStatus = () => {
    setStatus(getOutboxStatus());
  };

  return {
    pendingCount: status.pending,
    failedCount: status.failed,
    enqueueAction,
    replayOutbox: async () => {
      const res = await replayOutbox();
      refreshStatus();
      return res;
    },
    generateClientUuid,
    refreshStatus,
  };
}
