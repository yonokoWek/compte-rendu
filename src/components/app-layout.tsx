'use client';

import React from 'react';
import { FileText, BookOpen, Wallet, CheckSquare, History, TrendingUp } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { useT } from '@/lib/use-t';
import { cn } from '@/lib/utils';
import { getPreset, applyThemeCSSVariables } from '@/lib/themes';

const tabs = [
  { id: 'rapport', labelKey: 'tab.rapport', icon: FileText },
  { id: 'progression', labelKey: 'tab.progression', icon: TrendingUp },
  { id: 'lecture', labelKey: 'tab.lecture', icon: BookOpen },
  { id: 'finances', labelKey: 'tab.finances', icon: Wallet },
  { id: 'activites', labelKey: 'tab.activites', icon: CheckSquare },
  { id: 'historique', labelKey: 'tab.historique', icon: History },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const themeColor = useAppStore((s) => s.themeColor);
  const t = useT();

  return (
    <div
      className="min-h-screen flex flex-col bg-gray-50"
      style={applyThemeCSSVariables(getPreset(themeColor))}
    >
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
                  'flex flex-col items-center py-2 px-1.5 text-xs transition-colors min-w-[48px]',
                  isActive
                    ? 'text-[var(--theme-primary)]'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                <Icon className={cn('h-5 w-5 mb-0.5', isActive && 'stroke-[2.5px]')} />
                <span className={cn(isActive && 'font-semibold')}>{t(tab.labelKey)}</span>
                {isActive && (
                  <div className="w-1 h-1 rounded-full bg-[var(--theme-primary)] mt-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
