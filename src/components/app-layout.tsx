'use client';

import React from 'react';
import { FileText, BookOpen, Wallet, CheckSquare, History } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { cn } from '@/lib/utils';

const tabs = [
  { id: 'rapport', label: 'Rapport', icon: FileText },
  { id: 'lecture', label: 'Lecture', icon: BookOpen },
  { id: 'finances', label: 'Finances', icon: Wallet },
  { id: 'activites', label: 'Activités', icon: CheckSquare },
  { id: 'historique', label: 'Historique', icon: History },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Main content area */}
      <main className="flex-1 pb-20 overflow-auto">
        {children}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
        <div className="max-w-lg mx-auto flex items-center justify-around">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex flex-col items-center py-2 px-3 text-xs transition-colors min-w-[56px]',
                  isActive
                    ? 'text-orange-600'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                <Icon className={cn('h-5 w-5 mb-0.5', isActive && 'stroke-[2.5px]')} />
                <span className={cn(isActive && 'font-semibold')}>{tab.label}</span>
                {isActive && (
                  <div className="w-1 h-1 rounded-full bg-orange-600 mt-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
