import { create } from 'zustand';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, startOfMonth, endOfMonth, addMonths, subMonths, startOfYear, endOfYear, addYears, subYears, eachDayOfInterval, eachWeekOfInterval } from 'date-fns';
import { fr } from 'date-fns/locale';

export type PeriodType = 'week' | 'month' | 'year';

export interface PeriodRange {
  type: PeriodType;
  startDate: Date;
  endDate: Date;
  label: string;
}

interface AppState {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  period: PeriodRange;
  periodType: PeriodType;
  setPeriodType: (type: PeriodType) => void;
  nextPeriod: () => void;
  prevPeriod: () => void;
  goToCurrentPeriod: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  profileDialogOpen: boolean;
  setProfileDialogOpen: (open: boolean) => void;
}

function getPeriod(type: PeriodType, offset: number = 0): PeriodRange {
  const now = new Date();
  let startDate: Date;
  let endDate: Date;
  let label: string;

  if (type === 'week') {
    const base = addWeeks(now, offset);
    startDate = startOfWeek(base, { weekStartsOn: 1 });
    endDate = endOfWeek(base, { weekStartsOn: 1 });
    label = `Semaine du ${format(startDate, 'd MMM', { locale: fr })} au ${format(endDate, 'd MMM yyyy', { locale: fr })}`;
  } else if (type === 'month') {
    const base = addMonths(now, offset);
    startDate = startOfMonth(base);
    endDate = endOfMonth(base);
    label = `${format(base, 'MMMM yyyy', { locale: fr })}`;
  } else {
    const base = addYears(now, offset);
    startDate = startOfYear(base);
    endDate = endOfYear(base);
    label = `Année ${format(base, 'yyyy')}`;
  }

  return { type, startDate, endDate, label };
}

let _periodOffset = 0;

export const useAppStore = create<AppState>((set, get) => ({
  activeTab: 'rapport',
  setActiveTab: (tab) => set({ activeTab: tab }),
  period: getPeriod('week'),
  periodType: 'week',
  setPeriodType: (type) => {
    _periodOffset = 0;
    set({ periodType: type, period: getPeriod(type) });
  },
  nextPeriod: () => {
    _periodOffset += 1;
    set({ period: getPeriod(get().periodType, _periodOffset) });
  },
  prevPeriod: () => {
    _periodOffset -= 1;
    set({ period: getPeriod(get().periodType, _periodOffset) });
  },
  goToCurrentPeriod: () => {
    _periodOffset = 0;
    set({ period: getPeriod(get().periodType) });
  },
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  profileDialogOpen: false,
  setProfileDialogOpen: (open) => set({ profileDialogOpen: open }),
}));

// Helper functions
export function getDaysInRange(start: Date, end: Date): Date[] {
  return eachDayOfInterval({ start, end });
}

export function getWeeksInRange(start: Date, end: Date): { start: Date; end: Date; label: string }[] {
  const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
  return weeks.map((w, i) => {
    const wEnd = i === weeks.length - 1 ? end : eachDayOfInterval({ start: w, end: addWeeks(w, 1) }).slice(-1)[0];
    return {
      start: w,
      end: wEnd,
      label: `Sem ${i + 1} (${format(w, 'd', { locale: fr })} au ${format(wEnd, 'd MMM', { locale: fr })})`,
    };
  });
}

export function formatMinutes(totalMinutes: number): string {
  if (totalMinutes === 0) return '0';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m > 0 ? ` ${m}` : ''}`;
}

export const DAY_NAMES_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
