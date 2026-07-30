'use client';

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';
import AppLayout from '@/components/app-layout';
import CompteRenduTab from '@/components/compte-rendu-tab';
import LectureTab from '@/components/lecture-tab';
import FinancesTab from '@/components/finances-tab';
import ActivitiesTab from '@/components/activities-tab';
import HistoriqueTab from '@/components/historique-tab';
import ProfileDialog from '@/components/profile-dialog';
import { useAppStore } from '@/store/app-store';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      retry: 1,
    },
  },
});

function AppContent() {
  const activeTab = useAppStore((s) => s.activeTab);

  return (
    <>
      <AppLayout>
        {activeTab === 'rapport' && <CompteRenduTab />}
        {activeTab === 'lecture' && <LectureTab />}
        {activeTab === 'finances' && <FinancesTab />}
        {activeTab === 'activites' && <ActivitiesTab />}
        {activeTab === 'historique' && <HistoriqueTab />}
      </AppLayout>
      <ProfileDialog />
    </>
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
