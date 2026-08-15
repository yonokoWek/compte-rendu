'use client';

import React, { useMemo } from 'react';
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

  // Memoize theme style to prevent object recreation
  const themeStyle = useMemo(() => applyThemeCSSVariables(getPreset(themeColor)), [themeColor]);

  return (
    <div
      className="min-h-screen flex flex-col bg-gray-50"
      style={themeStyle}
    >
      {/* Main content area */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>

      {/* Bottom navigation - fixed with safe area */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 z-50 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-lg mx-auto flex items-center justify-around">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex flex-col items-center py-1.5 px-1 text-[10px] sm:text-xs min-w-[44px] sm:min-w-[48px] active:scale-95 transition-transform',
                  isActive
                    ? 'text-[var(--theme-primary)]'
                    : 'text-gray-400'
                )}
              >
                <Icon className={cn('h-4 w-4 sm:h-5 sm:w-5', isActive && 'stroke-[2.5px]')} />
                <span className={cn('mt-0.5 leading-tight', isActive && 'font-semibold')}>{t(tab.labelKey)}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
