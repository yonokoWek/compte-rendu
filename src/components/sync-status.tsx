'use client';

import React, { useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle, AlertCircle, CloudOff, CloudUpload } from 'lucide-react';
import { useOfflineSync } from '@/lib/offline-sync';
import { useT } from '@/lib/use-t';
import { Button } from '@/components/ui/button';

export default function SyncStatusBar() {
  const { isOnline, pendingCount, isSyncing, lastSyncStatus, lastSyncMessage, forceSync } = useOfflineSync();
  const t = useT();

  // Don't show anything when everything is fine
  if (isOnline && pendingCount === 0 && lastSyncStatus === 'idle') {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[100]">
      {/* Offline banner */}
      {!isOnline && (
        <div className="bg-amber-500 text-white px-4 py-1.5 flex items-center justify-center gap-2 text-xs font-medium">
          <WifiOff className="h-3.5 w-3.5" />
          <span>{t('offline.mode') || 'Mode hors ligne — données sauvegardées localement'}</span>
        </div>
      )}

      {/* Syncing / Pending items / Sync completed */}
      {isOnline && (pendingCount > 0 || isSyncing || lastSyncStatus !== 'idle') && (
        <div className={`px-4 py-1.5 flex items-center justify-center gap-2 text-xs font-medium ${
          lastSyncStatus === 'error' ? 'bg-red-500 text-white' :
          isSyncing ? 'bg-blue-500 text-white' :
          lastSyncStatus === 'success' ? 'bg-green-500 text-white' :
          'bg-amber-500 text-white'
        }`}>
          {isSyncing && (
            <>
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              <span>{t('offline.syncing') || 'Synchronisation...'}</span>
            </>
          )}
          {!isSyncing && lastSyncStatus === 'success' && (
            <>
              <CheckCircle className="h-3.5 w-3.5" />
              <span>{lastSyncMessage}</span>
            </>
          )}
          {!isSyncing && lastSyncStatus === 'error' && (
            <>
              <AlertCircle className="h-3.5 w-3.5" />
              <span>{lastSyncMessage}</span>
            </>
          )}
          {!isSyncing && lastSyncStatus === 'idle' && pendingCount > 0 && (
            <>
              <CloudUpload className="h-3.5 w-3.5" />
              <span>
                {pendingCount} {t('offline.pending') || 'élément(s) en attente'}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-5 px-2 text-white hover:bg-white/20 ml-1"
                onClick={forceSync}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                {t('offline.syncNow') || 'Synchroniser'}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Small persistent sync indicator in the corner (always visible when authenticated)
 */
export function SyncIndicator() {
  const { isOnline, pendingCount } = useOfflineSync();

  if (isOnline && pendingCount === 0) return null;

  return (
    <div className="fixed bottom-20 right-3 z-50">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-all ${
          !isOnline
            ? 'bg-amber-500 text-white'
            : pendingCount > 0
            ? 'bg-orange-500 text-white animate-pulse'
            : 'bg-green-500 text-white'
        }`}
        title={
          !isOnline
            ? 'Hors ligne'
            : pendingCount > 0
            ? `${pendingCount} en attente`
            : 'Connecté'
        }
      >
        {!isOnline ? (
          <CloudOff className="h-4 w-4" />
        ) : (
          <CloudUpload className="h-4 w-4" />
        )}
        {pendingCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
            {pendingCount > 9 ? '9+' : pendingCount}
          </span>
        )}
      </div>
    </div>
  );
}
