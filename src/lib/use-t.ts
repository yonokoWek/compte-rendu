'use client';

import { useAppStore } from '@/store/app-store';
import { translations, type Lang } from '@/lib/i18n';

/**
 * Translation hook. Returns a `t()` function.
 * Usage: const t = useT(); <p>{t('tab.rapport')}</p>
 */
export function useT(): (key: string, params?: Record<string, string | number>) => string {
  const lang = useAppStore((s) => s.language) as Lang;
  const dict = translations[lang] || translations.fr;

  return (key: string, params?: Record<string, string | number>) => {
    let str = dict[key] || translations.fr[key] || key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.replace(`{${k}}`, String(v));
      }
    }
    return str;
  };
}

/**
 * Get day names for the current language.
 */
export function useDayNames(): string[] {
  const t = useT();
  return [
    t('day.mon'), t('day.tue'), t('day.wed'), t('day.thu'),
    t('day.fri'), t('day.sat'), t('day.sun'),
  ];
}
