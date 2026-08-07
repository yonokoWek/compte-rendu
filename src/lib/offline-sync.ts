'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface OfflineQueueEntry {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  timestamp: number;
}

interface OfflineSyncState {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncStatus: 'idle' | 'syncing' | 'success' | 'error';
  lastSyncMessage: string;
}

function openSyncDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('cr-offline-sync', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getQueueCount(): Promise<number> {
  try {
    const db = await openSyncDB();
    const tx = db.transaction('queue', 'readonly');
    return new Promise((resolve) => {
      const req = tx.objectStore('queue').count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}

async function clearQueue(): Promise<void> {
  try {
    const db = await openSyncDB();
    const tx = db.transaction('queue', 'readwrite');
    tx.objectStore('queue').clear();
    await tx.done;
  } catch {
    // Ignore errors
  }
}

export function useOfflineSync(): OfflineSyncState & {
  forceSync: () => void;
  pendingEntries: OfflineQueueEntry[];
  refreshCount: () => void;
} {
  const [state, setState] = useState<OfflineSyncState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    pendingCount: 0,
    isSyncing: false,
    lastSyncStatus: 'idle',
    lastSyncMessage: '',
  });
  const [pendingEntries, setPendingEntries] = useState<OfflineQueueEntry[]>([]);
  const queryClient = useQueryClient();
  const swRef = useRef<ServiceWorker | null>(null);

  // Get service worker reference
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        swRef.current = reg.active;
      });
    }
  }, []);

  // Declare callbacks BEFORE the useEffects that reference them
  const refreshCount = useCallback(async () => {
    const count = await getQueueCount();
    setState((s) => ({ ...s, pendingCount: count }));

    // Also fetch pending entries for display
    try {
      const db = await openSyncDB();
      const tx = db.transaction('queue', 'readonly');
      const entries = await new Promise<OfflineQueueEntry[]>((resolve) => {
        const req = tx.objectStore('queue').getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
      setPendingEntries(entries.sort((a, b) => b.timestamp - a.timestamp));
    } catch {
      setPendingEntries([]);
    }
  }, []);

  const forceSync = useCallback(() => {
    setState((s) => ({ ...s, isSyncing: true, lastSyncStatus: 'syncing' }));

    if (swRef.current) {
      swRef.current.postMessage({ type: 'FORCE_SYNC' });
    }
  }, []);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setState((s) => ({ ...s, isOnline: true }));
      // Auto-sync when coming back online
      setTimeout(() => {
        refreshCount();
        forceSync();
      }, 1000);
    };

    const handleOffline = () => {
      setState((s) => ({ ...s, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshCount, forceSync]);

  // Listen for service worker messages
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handler = (event: MessageEvent) => {
      const data = event.data;

      if (data.type === 'OFFLINE_QUEUE_UPDATED') {
        setState((s) => ({ ...s, pendingCount: s.pendingCount + 1 }));
      }

      if (data.type === 'SYNC_COMPLETED') {
        setState((s) => ({
          ...s,
          isSyncing: false,
          lastSyncStatus: data.failed > 0 ? 'error' : 'success',
          lastSyncMessage:
            data.failed > 0
              ? `${data.success} synchronisé(s), ${data.failed} échoué(s)`
              : `${data.success} élément(s) synchronisé(s)`,
          pendingCount: data.remaining,
        }));

        if (data.success > 0) {
          // Invalidate all queries to refresh data
          queryClient.invalidateQueries();
        }

        // Auto-hide status message after 5s
        setTimeout(() => {
          setState((s) => ({
            ...s,
            lastSyncStatus: 'idle',
            lastSyncMessage: '',
          }));
        }, 5000);
      }

      if (data.type === 'QUEUE_COUNT') {
        setState((s) => ({ ...s, pendingCount: data.count }));
      }
    };

    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, [queryClient]);

  // Initial count check
  useEffect(() => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) return;
    let cancelled = false;
    openSyncDB().then((db) => {
      if (cancelled) return;
      const tx = db.transaction('queue', 'readonly');
      const req = tx.objectStore('queue').count();
      req.onsuccess = () => {
        if (!cancelled) {
          setState((s) => ({ ...s, pendingCount: req.result }));
        }
      };
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return {
    ...state,
    forceSync,
    pendingEntries,
    refreshCount,
  };
}

// Enhanced fetch that works offline
export function offlineAwareFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // If online, do normal fetch
  if (navigator.onLine) {
    return fetch(url, options);
  }

  // If offline and it's a mutation, queue it
  if (options.method && options.method !== 'GET' && options.method !== 'HEAD') {
    return queueMutation(url, options);
  }

  // For GET requests, the service worker will serve from cache
  return fetch(url, options);
}

async function queueMutation(
  url: string,
  options: RequestInit
): Promise<Response> {
  try {
    const body = options.body ? String(options.body) : '';
    const headers: Record<string, string> = {};
    if (options.headers) {
      const h = new Headers(options.headers);
      h.forEach((value, key) => {
        headers[key] = value;
      });
    }

    const entry: OfflineQueueEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      url,
      method: options.method || 'POST',
      headers,
      body,
      timestamp: Date.now(),
    };

    const db = await openSyncDB();
    const tx = db.transaction('queue', 'readwrite');
    tx.objectStore('queue').add(entry);
    await tx.done;

    return new Response(
      JSON.stringify({ queued: true, id: entry.id, offline: true }),
      {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: 'Offline and failed to queue' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

export { clearQueue, getQueueCount };
