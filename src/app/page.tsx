'use client';

import React, { useEffect, useState, useCallback } from 'react';
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
import { getPreset } from '@/lib/themes';
import { Loader2 } from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      retry: 1,
    },
  },
});

function AppContent() {
  const [mounted, setMounted] = useState(false);
  const [checking, setChecking] = useState(true);
  const activeTab = useAppStore((s) => s.activeTab);
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const setSessionToken = useAppStore((s) => s.setSessionToken);
  const setThemeColor = useAppStore((s) => s.setThemeColor);

  // Check existing session on mount
  useEffect(() => {
    const token = localStorage.getItem('cr_session_token');
    if (token) {
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
          }
        })
        .catch(() => {
          localStorage.removeItem('cr_session_token');
        })
        .finally(() => {
          setMounted(true);
          setChecking(false);
        });
    } else {
      setMounted(true);
      setChecking(false);
    }
  }, [setSessionToken, setThemeColor]);

  const handleAuthSuccess = useCallback(
    (token: string) => {
      setSessionToken(token);
      // Fetch theme after auth
      fetch('/api/auth/session', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.user?.themeColor) {
            setThemeColor(data.user.themeColor);
          }
        })
        .catch(() => {});
    },
    [setSessionToken, setThemeColor]
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
  if (!mounted || checking) {
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
      {activeTab === 'rapport' && <CompteRenduTab />}
      {activeTab === 'lecture' && <LectureTab />}
      {activeTab === 'finances' && <FinancesTab />}
      {activeTab === 'activites' && <ActivitiesTab />}
      {activeTab === 'historique' && <HistoriqueTab />}
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
