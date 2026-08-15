'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';
import AppLayout from '@/components/app-layout';
import CompteRenduTab from '@/components/compte-rendu-tab';
import LectureTab from '@/components/lecture-tab';
import FinancesTab from '@/components/finances-tab';
import ActivitiesTab from '@/components/activities-tab';
import HistoriqueTab from '@/components/historique-tab';
import ProgressionTab from '@/components/progression-tab';
import ProfileDialog from '@/components/profile-dialog';
import SyncStatusBar, { SyncIndicator } from '@/components/sync-status';
import AuthScreen from '@/components/auth-screen';
import { useAppStore } from '@/store/app-store';
import { useT } from '@/lib/use-t';
import { Loader2, LogOut, Download, UserPlus, CloudOff, Cloud, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes - reduce unnecessary refetches
      retry: 1,
    },
  },
});

type AppStatus = 'loading' | 'auth' | 'unauth';

// Register service worker
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[SW] Registered:', reg.scope);

        // Request periodic background sync if available
        if ('sync' in (ServiceWorkerRegistration as unknown as Record<string, unknown>)) {
          (reg as unknown as { sync: { register: (tag: string) => Promise<void> } }).sync
            .register('cr-sync-queue')
            .catch(() => {
              // Periodic sync not supported, that's fine
            });
        }

        // Listen for updates
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'activated') {
                console.log('[SW] New version activated');
              }
            });
          }
        });
      })
      .catch((err) => {
        console.warn('[SW] Registration failed:', err);
      });
  }
}

function AppContent() {
  const [status, setStatus] = useState<AppStatus>('loading');
  const [showAuthScreen, setShowAuthScreen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const activeTab = useAppStore((s) => s.activeTab);
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const isGuest = useAppStore((s) => s.isGuest);
  const setIsGuest = useAppStore((s) => s.setIsGuest);
  const setSessionToken = useAppStore((s) => s.setSessionToken);
  const setThemeColor = useAppStore((s) => s.setThemeColor);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const setProfileDialogOpen = useAppStore((s) => s.setProfileDialogOpen);
  const initializedRef = useRef(false);
  const t = useT();

  // Register service worker on mount
  useEffect(() => {
    registerServiceWorker();
  }, []);

  // Listen for PWA install prompt
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Guest login function (defined before useEffect that uses it)
  const handleGuestLogin = async (deviceId: string) => {
    try {
      const res = await fetch('/api/auth/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId }),
      });
      const data = await res.json();
      if (res.status === 503) {
        // Database not configured
        toast.error('Serveur en cours de configuration. Veuillez réessayer dans quelques minutes.', { duration: 8000 });
        return;
      }
      if (!res.ok || !data.token) {
        // Database error or other failure
        toast.error('Impossible de se connecter au serveur. Veuillez réessayer.', { duration: 6000 });
        return;
      }
      localStorage.setItem('cr_session_token', data.token);
      setSessionToken(data.token);
      setIsGuest(true);
    } catch (err) {
      console.error('Guest login failed:', err);
      toast.error('Erreur de connexion au serveur. Vérifiez votre connexion internet.', { duration: 6000 });
    }
  };

  // Start as guest
  const handleStartAsGuest = () => {
    const deviceId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
    localStorage.setItem('cr_device_id', deviceId);
    handleGuestLogin(deviceId);
  };

  // Check existing session on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const token = localStorage.getItem('cr_session_token');
    const finish = () => setStatus('unauth');

    if (token) {
      // Validate existing session
      fetch('/api/auth/session', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => {
          if (!r.ok) throw new Error();
          return r.json();
        })
        .then((data) => {
          if (data.user) {
            setSessionToken(token);
            if (data.user.isGuest) setIsGuest(true);
            if (data.user.themeColor) setThemeColor(data.user.themeColor);
            if (data.user.language) setLanguage(data.user.language);
          }
        })
        .catch(() => {
          localStorage.removeItem('cr_session_token');
          localStorage.removeItem('cr_device_id');
        })
        .finally(finish);
    } else {
      finish();
    }
  }, []);

  // Periodically refresh session to keep it alive (every 24h)
  useEffect(() => {
    if (!isAuthenticated) return;

    const refreshSession = () => {
      const token = localStorage.getItem('cr_session_token');
      if (!token) return;
      fetch('/api/auth/session', {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    };

    // Refresh every 24 hours to keep session alive
    const interval = setInterval(refreshSession, 24 * 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Handle visibility change - refresh session + refetch queries (debounced 5s)
  useEffect(() => {
    if (!isAuthenticated) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;

      // Refresh session immediately
      const token = localStorage.getItem('cr_session_token');
      if (!token) return;
      fetch('/api/auth/session', {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});

      // Debounce query refetch to avoid burst of requests
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        queryClient.refetchQueries({ type: 'active' });
      }, 5000);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [isAuthenticated]);

  // Handle online/offline - refetch active queries when back online (debounced 5s)
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const handleOnline = () => {
      if (!isAuthenticated) return;
      // Debounce to avoid burst of requests
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        queryClient.refetchQueries({ type: 'active' });
      }, 5000);
    };

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [isAuthenticated]);

  const handleAuthSuccess = useCallback(
    (token: string) => {
      setSessionToken(token);
      setIsGuest(false);
      localStorage.removeItem('cr_device_id');
      setShowAuthScreen(false);
      fetch('/api/auth/session', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.user?.themeColor) {
            setThemeColor(data.user.themeColor);
          }
          if (data.user?.language) {
            setLanguage(data.user.language);
          }
        })
        .catch(() => {});
    },
    [setSessionToken, setThemeColor, setLanguage]
  );

  const handleLogout = useCallback(() => {
    const token = localStorage.getItem('cr_session_token');
    if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    localStorage.removeItem('cr_session_token');
    localStorage.removeItem('cr_device_id');
    setIsGuest(false);
    setSessionToken(null);
    setThemeColor('orange');
    queryClient.clear();
  }, [setSessionToken, setThemeColor]);

  const handleInstall = useCallback(async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === 'accepted') {
      setInstallPrompt(null);
    }
  }, [installPrompt]);

  // Show loading spinner while checking session
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // Show auth screen (not authenticated and no guest session)
  if (!isAuthenticated && status !== 'loading') {
    return (
      <>
        <AuthScreen onAuthSuccess={handleAuthSuccess} onStartAsGuest={handleStartAsGuest} />
        <Toaster position="top-center" richColors />
      </>
    );
  }

  // Show auth screen overlay if user clicked "create account" while guest
  if (showAuthScreen) {
    return (
      <>
        <AuthScreen onAuthSuccess={handleAuthSuccess} onStartAsGuest={handleStartAsGuest} />
        <Toaster position="top-center" richColors />
      </>
    );
  }

  // Show main app
  return (
    <AppLayout>
      {/* Sync status banner */}
      <SyncStatusBar />

      {/* Guest banner - encourage sign up for cross-device access */}
      {isGuest && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-amber-800 text-xs">
            <CloudOff className="h-4 w-4 shrink-0" />
            <span className="font-medium">{t('guest.bannerMessage')}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAuthScreen(true)}
            className="shrink-0 text-amber-700 border-amber-300 hover:bg-amber-100 text-xs h-7 px-2.5 gap-1"
          >
            <UserPlus className="h-3 w-3" />
            <span className="hidden sm:inline">{t('guest.createAccount')}</span>
            <span className="sm:hidden">{t('guest.signUp')}</span>
          </Button>
        </div>
      )}

      {/* Header with profile + logout + install */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-white/95 backdrop-blur-sm border-b border-gray-200">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setProfileDialogOpen(true)}
            className="h-9 w-9 rounded-full bg-[var(--theme-primary-light)] flex items-center justify-center hover:opacity-80 transition-opacity"
          >
            <span className="text-sm font-bold text-[var(--theme-primary)]">
              {(useAppStore.getState().themeColor || 'U').charAt(0).toUpperCase()}
            </span>
          </button>
          <div>
            <h1 className="text-sm font-bold text-gray-800">{t('app.title')}</h1>
            <p className="text-[10px] text-gray-500">{t('app.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* PWA Install button */}
          {installPrompt && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleInstall}
              className="text-gray-500 hover:text-green-600 h-8 px-2"
            >
              <Download className="h-4 w-4 mr-1" />
              <span className="text-xs">{t('offline.install') || 'Installer'}</span>
            </Button>
          )}
          {/* Guest: show create account button */}
          {isGuest ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAuthScreen(true)}
              className="text-gray-500 hover:text-[var(--theme-primary)] h-8 px-2"
            >
              <UserPlus className="h-4 w-4 mr-1" />
              <span className="text-xs">{t('guest.createAccount')}</span>
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-gray-500 hover:text-red-600 h-8 px-2"
            >
              <LogOut className="h-4 w-4 mr-1" />
              <span className="text-xs">{t('common.logout')}</span>
            </Button>
          )}
        </div>
      </header>

      {activeTab === 'rapport' && <CompteRenduTab />}
      {activeTab === 'progression' && <ProgressionTab />}
      {activeTab === 'lecture' && <LectureTab />}
      {activeTab === 'finances' && <FinancesTab />}
      {activeTab === 'activites' && <ActivitiesTab />}
      {activeTab === 'historique' && <HistoriqueTab />}

      <ProfileDialog />

      {/* Sync indicator (bottom-right corner) */}
      <SyncIndicator />
    </AppLayout>
  );
}

// Type for beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function Home() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
