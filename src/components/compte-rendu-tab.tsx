'use client';

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, eachDayOfInterval, getDay, differenceInCalendarDays } from 'date-fns';
import { useAppStore, DAY_NAMES_SHORT, formatMinutes, getDaysInRange, getWeeksInRange } from '@/store/app-store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  User,
  CalendarDays,
  FolderOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '@/lib/api';
import { generateClientPDF } from '@/lib/client-pdf';

interface Category {
  id: string;
  name: string;
  unit: string;
  sortOrder: number;
  isPersonal: boolean;
  icon: string;
  groupId: string | null;
  group: { id: string; name: string } | null;
}

interface Group {
  id: string;
  name: string;
  sortOrder: number;
  categories: Category[];
}

interface DailyEntry {
  id: string;
  date: string;
  categoryId: string;
  value: number;
  category: Category;
}

interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  assembly: string;
  mentor: string;
}

// Memoized cell input to prevent re-renders on sibling changes
const CellInput = React.memo(function CellInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (val: string) => void;
}) {
  return (
    <input
      type="number"
      min="0"
      inputMode="numeric"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder="0"
      className="w-11 h-7 text-center text-xs bg-transparent border border-transparent rounded focus:border-[var(--theme-primary)] focus:bg-[var(--theme-primary-light)] focus:outline-none"
    />
  );
});

export default function CompteRenduTab() {
  const period = useAppStore((s) => s.period);
  const periodType = useAppStore((s) => s.periodType);
  const setPeriodType = useAppStore((s) => s.setPeriodType);
  const nextPeriod = useAppStore((s) => s.nextPeriod);
  const prevPeriod = useAppStore((s) => s.prevPeriod);
  const goToCurrentPeriod = useAppStore((s) => s.goToCurrentPeriod);
  const setProfileDialogOpen = useAppStore((s) => s.setProfileDialogOpen);
  const queryClient = useQueryClient();

  // Fetch categories with groups
  const { data: catData } = useQuery<{
    categories: Category[];
    groups: Group[];
  }>({
    queryKey: ['categories'],
    queryFn: () => authFetch('/api/categories').then((r) => r.json()),
    staleTime: 1000 * 60 * 5, // 5 min cache - categories rarely change
  });
  const categories = catData?.categories || [];

  // Fetch entries
  const { data: entries = [], isLoading: entriesLoading } = useQuery<DailyEntry[]>({
    queryKey: ['entries', period.startDate, period.endDate],
    queryFn: () =>
      authFetch(
        `/api/entries?startDate=${format(period.startDate, 'yyyy-MM-dd')}&endDate=${format(period.endDate, 'yyyy-MM-dd')}`
      ).then((r) => r.json()),
    staleTime: 1000 * 10, // 10s stale time to reduce refetches
  });

  // Fetch profile
  const { data: profile } = useQuery<UserProfile>({
    queryKey: ['profile'],
    queryFn: () => authFetch('/api/profile').then((r) => r.json()),
    staleTime: 1000 * 60 * 5,
  });

  // Local optimistic state for entries
  const [localEntryMap, setLocalEntryMap] = useState<Record<string, number>>({});
  const saveTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Merge server entries with local optimistic updates
  const entryMap: Record<string, number> = useMemo(() => {
    const merged: Record<string, number> = {};
    for (const e of entries) {
      merged[`${e.date}_${e.categoryId}`] = e.value;
    }
    // Overlay local changes
    for (const [key, val] of Object.entries(localEntryMap)) {
      if (val !== undefined && val !== null) {
        merged[key] = val;
      }
    }
    return merged;
  }, [entries, localEntryMap]);

  // Debounced save to backend
  const handleCellChange = useCallback((categoryId: string, columnKey: string, dateKey: string, value: string) => {
    const numValue = parseInt(value) || 0;

    // Immediately update local state (optimistic)
    setLocalEntryMap((prev) => ({
      ...prev,
      [`${dateKey}_${categoryId}`]: numValue,
    }));

    // Clear previous timer for this cell
    const timerKey = `${categoryId}_${columnKey}`;
    if (saveTimerRef.current[timerKey]) {
      clearTimeout(saveTimerRef.current[timerKey]);
    }

    // Debounce backend save by 800ms
    saveTimerRef.current[timerKey] = setTimeout(() => {
      authFetch('/api/entries', {
        method: 'POST',
        body: JSON.stringify({ date: dateKey, categoryId, value: numValue }),
      }).then(() => {
        // On success, refetch in background and clear local override
        queryClient.invalidateQueries({ queryKey: ['entries'] }).then(() => {
          setLocalEntryMap((prev) => {
            const next = { ...prev };
            delete next[`${dateKey}_${categoryId}`];
            return next;
          });
        });
      }).catch(() => {
        toast.error('Erreur de sauvegarde');
      });
    }, 800);
  }, [queryClient]);

  // Calculate columns (memoized)
  const { columns, isSingleWeek } = useMemo(() => {
    const totalDays = differenceInCalendarDays(period.endDate, period.startDate) + 1;
    const single = totalDays <= 7;
    let cols: { key: string; label: string; date: string }[] = [];
    if (single) {
      cols = getDaysInRange(period.startDate, period.endDate).map((d) => {
        const dayIndex = getDay(d);
        return { key: format(d, 'yyyy-MM-dd'), label: DAY_NAMES_SHORT[dayIndex === 0 ? 6 : dayIndex - 1], date: format(d, 'yyyy-MM-dd') };
      });
    } else {
      cols = getWeeksInRange(period.startDate, period.endDate).map((w, i) => ({
        key: `week-${i}`,
        label: `Sem ${i + 1}`,
        date: `${format(w.start, 'yyyy-MM-dd')}_${format(w.end, 'yyyy-MM-dd')}`,
      }));
    }
    return { columns: cols, isSingleWeek: single };
  }, [period.startDate, period.endDate]);

  const getCellValue = useCallback((categoryId: string, col: typeof columns[0]) => {
    if (isSingleWeek) return entryMap[`${col.date}_${categoryId}`] || 0;
    const [wStart, wEnd] = col.date.split('_');
    let total = 0;
    for (const day of eachDayOfInterval({ start: new Date(wStart), end: new Date(wEnd) })) {
      total += entryMap[`${format(day, 'yyyy-MM-dd')}_${categoryId}`] || 0;
    }
    return total;
  }, [entryMap, isSingleWeek, columns]);

  const getRowTotal = useCallback((catId: string) => columns.reduce((s, col) => s + getCellValue(catId, col), 0), [columns, getCellValue]);

  const personalCategories = useMemo(() => categories.filter((c) => c.isPersonal && c.unit === 'minutes'), [categories]);
  const getPersonalTotal = useCallback((col?: typeof columns[0]) => {
    if (col) return personalCategories.reduce((s, cat) => s + getCellValue(cat.id, col), 0);
    return columns.reduce((s, col) => s + personalCategories.reduce((s2, cat) => s2 + getCellValue(cat.id, col), 0), 0);
  }, [columns, personalCategories, getCellValue]);

  // PDF generation
  const [pdfLoading, setPdfLoading] = useState(false);
  const handleExportPDF = async () => {
    setPdfLoading(true);
    try {
      const reportRes = await authFetch('/api/report', {
        method: 'POST',
        body: JSON.stringify({ startDate: format(period.startDate, 'yyyy-MM-dd'), endDate: format(period.endDate, 'yyyy-MM-dd') }),
      });
      const reportData = await reportRes.json();
      await generateClientPDF(
        reportData.html,
        `compte-rendu-${format(period.startDate, 'yyyy-MM-dd')}.pdf`
      );
      toast.success('PDF exporté');
    } catch {
      toast.error('Erreur PDF');
    } finally {
      setPdfLoading(false);
    }
  };

  const displayName = profile ? `${profile.firstName} ${profile.lastName}`.trim() : 'Mon Compte';

  // Group categories for display (memoized)
  const { groupedDisplay, ungrouped } = useMemo(() => {
    const grouped = new Map<string, Category[]>();
    const un: Category[] = [];
    for (const cat of categories) {
      if (cat.groupId && cat.group) {
        if (!grouped.has(cat.groupId)) grouped.set(cat.groupId, []);
        grouped.get(cat.groupId)!.push(cat);
      } else {
        un.push(cat);
      }
    }
    return { groupedDisplay: grouped, ungrouped: un };
  }, [categories]);

  return (
    <div className="max-w-6xl mx-auto p-2 sm:p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-[var(--theme-primary-light)] p-2 rounded-full">
            <CalendarDays className="h-5 w-5 text-[var(--theme-primary)]" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-gray-900">Compte Rendu</h1>
            <p className="text-[10px] sm:text-xs text-gray-500">{displayName} {profile?.assembly ? `• ${profile.assembly}` : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setProfileDialogOpen(true)}>
            <User className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={pdfLoading} className="gap-1 text-[var(--theme-primary)] border-[var(--theme-primary)] hover:bg-[var(--theme-primary-light)] h-8">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline text-xs">PDF</span>
          </Button>
        </div>
      </div>

      {/* Period selector */}
      <Card className="border-[var(--theme-primary)]">
        <CardContent className="p-2 sm:p-3">
          <div className="flex items-center justify-between gap-1">
            <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={prevPeriod}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 flex items-center justify-center gap-2">
              <Select value={periodType} onValueChange={(v) => setPeriodType(v as 'week' | 'month' | 'year')}>
                <SelectTrigger className="w-24 h-7 text-[11px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Semaine</SelectItem>
                  <SelectItem value="month">Mois</SelectItem>
                  <SelectItem value="year">Année</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs sm:text-sm font-medium text-gray-800 truncate">{period.label}</span>
            </div>
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="sm" className="text-[10px] h-7 px-1.5" onClick={goToCurrentPeriod}>Auj.</Button>
              <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={nextPeriod}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main data table - mobile optimized */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto -mx-0">
          <table className="w-full text-[11px] sm:text-xs border-collapse min-w-[500px]">
            <thead>
              <tr className="sticky top-0 z-10">
                <th className="bg-[var(--theme-primary)] text-white px-1.5 sm:px-2 py-1.5 text-left font-semibold text-[11px] sm:text-xs min-w-[100px] sm:min-w-[130px]">Activité</th>
                {columns.map((col) => (
                  <th key={col.key} className="bg-[var(--theme-primary)] text-white px-1 sm:px-2 py-1.5 text-center font-semibold text-[11px] sm:text-xs min-w-[40px] sm:min-w-[55px]">{col.label}</th>
                ))}
                <th className="bg-[var(--theme-primary)] text-white px-1.5 sm:px-2 py-1.5 text-center font-semibold text-[11px] sm:text-xs min-w-[45px] sm:min-w-[55px]">Total</th>
              </tr>
            </thead>
            <tbody>
              {entriesLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td className="bg-[var(--theme-primary-light)] px-2 py-1.5"><Skeleton className="h-3 w-20" /></td>
                    {columns.map((_, j) => <td key={j} className="px-1 py-1.5"><Skeleton className="h-6 w-7 mx-auto" /></td>)}
                  </tr>
                ))
              ) : (
                <>
                  {/* Grouped rows */}
                  {Array.from(groupedDisplay.entries()).map(([gId, cats]) => {
                    const groupName = cats[0]?.group?.name || '';
                    return (
                      <React.Fragment key={`group-${gId}`}>
                        <tr>
                          <td colSpan={columns.length + 2} className="bg-[var(--theme-primary)] text-white px-2 sm:px-3 py-1 text-left text-[11px] sm:text-xs font-bold">
                            <FolderOpen className="h-3 w-3 inline mr-1" />
                            {groupName}
                          </td>
                        </tr>
                        {cats.map((cat, rowIndex) => (
                          <tr key={cat.id} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-[var(--theme-primary-light)]/30'}>
                            <td className="px-1.5 sm:px-2 py-1 text-left font-medium text-[10px] sm:text-xs whitespace-nowrap text-gray-700">
                              {cat.name}
                            </td>
                            {columns.map((col) => {
                              const val = getCellValue(cat.id, col);
                              const dateKey = isSingleWeek ? col.key : col.date.split('_')[0];
                              return (
                                <td key={col.key} className="px-0.5 py-0.5 text-center">
                                  <CellInput
                                    value={val}
                                    onChange={(v) => handleCellChange(cat.id, col.key, dateKey, v)}
                                  />
                                </td>
                              );
                            })}
                            <td className="px-1.5 py-1 text-center font-bold text-[11px] sm:text-xs text-[var(--theme-primary)] bg-[var(--theme-primary-light)]/50">
                              {cat.unit === 'minutes' ? formatMinutes(getRowTotal(cat.id)) : getRowTotal(cat.id) || ''}
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}

                  {/* Ungrouped rows */}
                  {ungrouped.length > 0 && (
                    <>
                      <tr>
                        <td colSpan={columns.length + 2} className="bg-gray-200 text-gray-600 px-2 sm:px-3 py-1 text-left text-[11px] sm:text-xs font-semibold">
                          Sans groupe
                        </td>
                      </tr>
                      {ungrouped.map((cat, rowIndex) => (
                        <tr key={cat.id} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-[var(--theme-primary-light)]/30'}>
                          <td className="px-1.5 sm:px-2 py-1 text-left font-medium text-[10px] sm:text-xs whitespace-nowrap text-gray-700">
                            {cat.name}
                          </td>
                          {columns.map((col) => {
                            const val = getCellValue(cat.id, col);
                            const dateKey = isSingleWeek ? col.key : col.date.split('_')[0];
                            return (
                              <td key={col.key} className="px-0.5 py-0.5 text-center">
                                <CellInput
                                  value={val}
                                  onChange={(v) => handleCellChange(cat.id, col.key, dateKey, v)}
                                />
                              </td>
                            );
                          })}
                          <td className="px-1.5 py-1 text-center font-bold text-[11px] sm:text-xs text-[var(--theme-primary)] bg-[var(--theme-primary-light)]/50">
                            {cat.unit === 'minutes' ? formatMinutes(getRowTotal(cat.id)) : getRowTotal(cat.id) || ''}
                          </td>
                        </tr>
                      ))}
                    </>
                  )}

                  {/* Personal total row */}
                  {personalCategories.length > 0 && (
                    <tr className="bg-[var(--theme-primary)]">
                      <td className="px-2 py-1.5 text-left font-bold text-[11px] sm:text-xs text-white">
                        Temps avec le Seigneur
                      </td>
                      {columns.map((col) => (
                        <td key={col.key} className="px-1.5 py-1.5 text-center font-bold text-[11px] sm:text-xs text-white">
                          {formatMinutes(getPersonalTotal(col))}
                        </td>
                      ))}
                      <td className="px-1.5 py-1.5 text-center font-bold text-xs sm:text-sm text-yellow-300">
                        {formatMinutes(getPersonalTotal())}
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
