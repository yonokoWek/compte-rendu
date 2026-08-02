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
import ProfileDialog from '@/components/profile-dialog';
import AuthScreen from '@/components/auth-screen';
import { useAppStore } from '@/store/app-store';
import { useT } from '@/lib/use-t';
import { Loader2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      retry: 1,
    },
  },
});

type AppStatus = 'loading' | 'auth' | 'unauth';

function AppContent() {
  const [status, setStatus] = useState<AppStatus>('loading');
  const activeTab = useAppStore((s) => s.activeTab);
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const setSessionToken = useAppStore((s) => s.setSessionToken);
  const setThemeColor = useAppStore((s) => s.setThemeColor);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const setProfileDialogOpen = useAppStore((s) => s.setProfileDialogOpen);
  const initializedRef = useRef(false);
  const t = useT();

  // Check existing session on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const token = localStorage.getItem('cr_session_token');
    const finish = () => setStatus('unauth');

    if (!token) {
      finish();
      return;
    }

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
          if (data.user.themeColor) {
            setThemeColor(data.user.themeColor);
          }
          if (data.user.language) {
            setLanguage(data.user.language);
          }
        }
      })
      .catch(() => {
        localStorage.removeItem('cr_session_token');
      })
      .finally(finish);
  }, [setSessionToken, setThemeColor, setLanguage]);

  const handleAuthSuccess = useCallback(
    (token: string) => {
      setSessionToken(token);
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
    setSessionToken(null);
    setThemeColor('orange');
    queryClient.clear();
  }, [setSessionToken, setThemeColor]);

  // Show loading spinner while checking session
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // Show auth screen if not authenticated
  if (!isAuthenticated) {
    return (
      <>
        <AuthScreen onAuthSuccess={handleAuthSuccess} />
        <Toaster position="top-center" richColors />
      </>
    );
  }

  // Show main app
  return (
    <AppLayout>
      {/* Header with profile + logout */}
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
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="text-gray-500 hover:text-red-600 h-8 px-2"
        >
          <LogOut className="h-4 w-4 mr-1" />
          <span className="text-xs">{t('common.logout')}</span>
        </Button>
      </header>

      {activeTab === 'rapport' && <CompteRenduTab />}
      {activeTab === 'lecture' && <LectureTab />}
      {activeTab === 'finances' && <FinancesTab />}
      {activeTab === 'activites' && <ActivitiesTab />}
      {activeTab === 'historique' && <HistoriqueTab />}

      <ProfileDialog />
    </AppLayout>
  );
}

export default function Home() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
