'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, eachDayOfInterval, getDay, differenceInCalendarDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAppStore, DAY_NAMES_SHORT, formatMinutes, getDaysInRange, getWeeksInRange } from '@/store/app-store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
} from 'lucide-react';
import { toast } from 'sonner';

interface Category {
  id: string;
  name: string;
  unit: string;
  sortOrder: number;
  isPersonal: boolean;
  icon: string;
}

interface DailyEntry {
  id: string;
  date: string;
  categoryId: string;
  value: number;
  note: string;
  category: Category;
}

interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  assembly: string;
  mentor: string;
}

export default function CompteRenduTab() {
  const period = useAppStore((s) => s.period);
  const periodType = useAppStore((s) => s.periodType);
  const setPeriodType = useAppStore((s) => s.setPeriodType);
  const nextPeriod = useAppStore((s) => s.nextPeriod);
  const prevPeriod = useAppStore((s) => s.prevPeriod);
  const goToCurrentPeriod = useAppStore((s) => s.goToCurrentPeriod);
  const setProfileDialogOpen = useAppStore((s) => s.setProfileDialogOpen);
  const queryClient = useQueryClient();

  // Fetch categories
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => fetch('/api/categories').then((r) => r.json()),
  });

  // Fetch entries
  const { data: entries = [], isLoading: entriesLoading } = useQuery<DailyEntry[]>({
    queryKey: ['entries', period.startDate, period.endDate],
    queryFn: () =>
      fetch(
        `/api/entries?startDate=${format(period.startDate, 'yyyy-MM-dd')}&endDate=${format(period.endDate, 'yyyy-MM-dd')}`
      ).then((r) => r.json()),
  });

  // Fetch profile
  const { data: profile } = useQuery<UserProfile>({
    queryKey: ['profile'],
    queryFn: () => fetch('/api/profile').then((r) => r.json()),
  });

  // Save entry mutation
  const saveEntry = useMutation({
    mutationFn: (data: { date: string; categoryId: string; value: number }) =>
      fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['entries'] }),
  });

  // Calculate columns
  const totalDays = differenceInCalendarDays(period.endDate, period.startDate) + 1;
  const isSingleWeek = totalDays <= 7;

  let columns: { key: string; label: string; date: string }[] = [];

  if (isSingleWeek) {
    columns = getDaysInRange(period.startDate, period.endDate).map((d) => {
      const dayIndex = getDay(d);
      const adjustedIndex = dayIndex === 0 ? 6 : dayIndex - 1;
      return {
        key: format(d, 'yyyy-MM-dd'),
        label: DAY_NAMES_SHORT[adjustedIndex],
        date: format(d, 'yyyy-MM-dd'),
      };
    });
  } else {
    columns = getWeeksInRange(period.startDate, period.endDate).map((w, i) => ({
      key: `week-${i}`,
      label: `Sem ${i + 1}`,
      date: `${format(w.start, 'yyyy-MM-dd')}_${format(w.end, 'yyyy-MM-dd')}`,
    }));
  }

  // Build entry map
  const entryMap: Record<string, number> = {};
  for (const e of entries) {
    entryMap[`${e.date}_${e.categoryId}`] = e.value;
  }

  // Calculate cell value
  const getCellValue = (categoryId: string, column: typeof columns[0]) => {
    if (isSingleWeek) {
      return entryMap[`${column.date}_${categoryId}`] || 0;
    } else {
      const [wStart, wEnd] = column.date.split('_');
      const days = eachDayOfInterval({
        start: new Date(wStart),
        end: new Date(wEnd),
      });
      let total = 0;
      for (const day of days) {
        total += entryMap[`${format(day, 'yyyy-MM-dd')}_${categoryId}`] || 0;
      }
      return total;
    }
  };

  // Calculate row total
  const getRowTotal = (categoryId: string) => {
    return columns.reduce((sum, col) => sum + getCellValue(categoryId, col), 0);
  };

  // Calculate personal total
  const personalCategories = categories.filter((c) => c.isPersonal && c.unit === 'minutes');
  const getPersonalTotal = (column?: typeof columns[0]) => {
    if (column) {
      return personalCategories.reduce((sum, cat) => sum + getCellValue(cat.id, column), 0);
    }
    return columns.reduce(
      (sum, col) =>
        sum +
        personalCategories.reduce((s, cat) => s + getCellValue(cat.id, col), 0),
      0
    );
  };

  const handleCellChange = (categoryId: string, columnKey: string, value: string) => {
    const numValue = parseInt(value) || 0;
    if (isSingleWeek) {
      saveEntry.mutate({ date: columnKey, categoryId, value: numValue });
    } else {
      // For multi-week, we need to distribute the value - just store in first day of week
      const [wStart] = columnKey.split('_');
      saveEntry.mutate({ date: wStart, categoryId, value: numValue });
    }
  };

  // PDF generation
  const [pdfLoading, setPdfLoading] = useState(false);
  const handleExportPDF = async () => {
    setPdfLoading(true);
    try {
      const reportRes = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: format(period.startDate, 'yyyy-MM-dd'),
          endDate: format(period.endDate, 'yyyy-MM-dd'),
        }),
      });
      const reportData = await reportRes.json();

      const pdfRes = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: reportData.html }),
      });
      const pdfData = await pdfRes.json();

      const link = document.createElement('a');
      link.href = pdfData.pdf;
      link.download = `compte-rendu-${format(period.startDate, 'yyyy-MM-dd')}.pdf`;
      link.click();
      toast.success('PDF exporté avec succès');
    } catch {
      toast.error('Erreur lors de la génération du PDF');
    } finally {
      setPdfLoading(false);
    }
  };

  const displayName = profile
    ? `${profile.firstName} ${profile.lastName}`.trim()
    : 'Mon Compte';

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-orange-100 p-2 rounded-full">
            <CalendarDays className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Compte Rendu</h1>
            <p className="text-xs text-gray-500">{displayName} {profile?.assembly ? `• ${profile.assembly}` : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setProfileDialogOpen(true)}>
            <User className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            disabled={pdfLoading}
            className="gap-1 text-orange-600 border-orange-200 hover:bg-orange-50"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">PDF</span>
          </Button>
        </div>
      </div>

      {/* Period selector */}
      <Card className="border-orange-200">
        <CardContent className="p-3">
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="icon" className="shrink-0" onClick={prevPeriod}>
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex-1 flex items-center justify-center gap-2">
              <Select value={periodType} onValueChange={(v) => setPeriodType(v as 'week' | 'month' | 'year')}>
                <SelectTrigger className="w-28 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Semaine</SelectItem>
                  <SelectItem value="month">Mois</SelectItem>
                  <SelectItem value="year">Année</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm font-medium text-gray-800 truncate">
                {period.label}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="text-xs h-8 px-2" onClick={goToCurrentPeriod}>
                Auj.
              </Button>
              <Button variant="ghost" size="icon" className="shrink-0" onClick={nextPeriod}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main data table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-orange-500 text-white px-2 py-2 text-left font-semibold text-xs min-w-[130px] z-10 rounded-tl-lg">
                    Activité
                  </th>
                  <th className="bg-orange-400 text-white px-1 py-2 text-center font-semibold text-xs w-10">
                    {isSingleWeek ? 'Min' : ''}
                  </th>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className="bg-orange-500 text-white px-2 py-2 text-center font-semibold text-xs min-w-[55px]"
                    >
                      {col.label}
                    </th>
                  ))}
                  <th className="bg-orange-600 text-white px-2 py-2 text-center font-semibold text-xs min-w-[55px] rounded-tr-lg">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {entriesLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      <td className="bg-orange-100 px-2 py-2">
                        <Skeleton className="h-4 w-24" />
                      </td>
                      {columns.map((_, j) => (
                        <td key={j} className="px-2 py-2">
                          <Skeleton className="h-6 w-8 mx-auto" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  categories.map((cat, rowIndex) => (
                    <tr
                      key={cat.id}
                      className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-orange-50/50'}
                    >
                      <td className="sticky left-0 px-2 py-1.5 text-left font-medium text-xs bg-inherit z-10 whitespace-nowrap border-r border-orange-100">
                        <div className="flex items-center gap-1">
                          <span className={`text-[10px] ${rowIndex % 2 === 0 ? 'text-orange-600' : 'text-orange-500'}`}>
                            ●
                          </span>
                          {cat.name}
                        </div>
                      </td>
                      <td className="px-1 py-1.5 text-center text-[10px] text-gray-400 bg-orange-100/50">
                        {cat.unit === 'minutes' ? 'min' : 'Part.'}
                      </td>
                      {columns.map((col) => {
                        const val = getCellValue(cat.id, col);
                        return (
                          <td key={col.key} className="px-1 py-1 text-center">
                            <input
                              type="number"
                              min="0"
                              value={val || ''}
                              onChange={(e) => handleCellChange(cat.id, col.key, e.target.value)}
                              placeholder="0"
                              className="w-12 h-7 text-center text-xs bg-transparent border border-transparent rounded hover:border-orange-300 focus:border-orange-400 focus:bg-orange-50 focus:outline-none transition-colors"
                            />
                          </td>
                        );
                      })}
                      <td className="px-2 py-1.5 text-center font-bold text-xs bg-orange-100/80">
                        {cat.unit === 'minutes'
                          ? formatMinutes(getRowTotal(cat.id))
                          : getRowTotal(cat.id) || ''}
                      </td>
                    </tr>
                  ))
                )}

                {/* Personal total row */}
                <tr className="bg-orange-600">
                  <td
                    colSpan={2}
                    className="sticky left-0 px-2 py-2 text-left font-bold text-xs text-white z-10"
                  >
                    Temps seul avec le Seigneur
                  </td>
                  {columns.map((col) => (
                    <td key={col.key} className="px-2 py-2 text-center font-bold text-xs text-white">
                      {formatMinutes(getPersonalTotal(col))}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-center font-bold text-sm text-white">
                    {formatMinutes(getPersonalTotal())}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
