'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, addWeeks, subWeeks, startOfWeek, endOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Download, CalendarDays, ChevronLeft, ChevronRight, Clock, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '@/lib/api';
import { formatMinutes } from '@/store/app-store';
import { generateClientPDF } from '@/lib/client-pdf';

interface Category {
  id: string;
  name: string;
  unit: string;
  isPersonal: boolean;
}

interface DailyEntry {
  date: string;
  categoryId: string;
  value: number;
  category: Category;
}

interface FinanceEntry {
  id: string;
  date: string;
  type: string;
  label: string;
  amount: number;
}

export default function HistoriqueTab() {
  const [selectedStart, setSelectedStart] = useState<Date | undefined>(undefined);
  const [selectedEnd, setSelectedEnd] = useState<Date | undefined>(undefined);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Fetch categories for computing totals
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => authFetch('/api/categories').then((r) => r.json()),
  });

  // Generate list of past weeks
  const now = new Date();
  const weekHistory = Array.from({ length: 12 }, (_, i) => {
    const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
    return { start: weekStart, end: weekEnd };
  });

  // Fetch entries for each week
  const { data: allEntries = [] } = useQuery<DailyEntry[]>({
    queryKey: ['all-entries'],
    queryFn: () =>
      authFetch(
        `/api/entries?startDate=${format(weekHistory[weekHistory.length - 1].start, 'yyyy-MM-dd')}&endDate=${format(now, 'yyyy-MM-dd')}`
      ).then((r) => r.json()),
  });

  const handleExportPDF = async (start: Date, end: Date) => {
    setPdfLoading(true);
    try {
      const reportRes = await authFetch('/api/report', {
        method: 'POST',
        body: JSON.stringify({
          startDate: format(start, 'yyyy-MM-dd'),
          endDate: format(end, 'yyyy-MM-dd'),
        }),
      });
      const reportData = await reportRes.json();
      await generateClientPDF(
        reportData.html,
        `compte-rendu-${format(start, 'yyyy-MM-dd')}.pdf`
      );
      toast.success('PDF exporté avec succès');
    } catch {
      toast.error('Erreur lors de la génération du PDF');
    } finally {
      setPdfLoading(false);
    }
  };

  const handleCustomExport = async () => {
    if (!selectedStart || !selectedEnd) {
      toast.error('Sélectionnez une période');
      return;
    }
    if (selectedStart > selectedEnd) {
      toast.error('La date de début doit être avant la date de fin');
      return;
    }
    await handleExportPDF(selectedStart, selectedEnd);
  };

  // Compute week summaries
  const weekSummaries = weekHistory.map((week) => {
    const entries = allEntries.filter(
      (e) => e.date >= format(week.start, 'yyyy-MM-dd') && e.date <= format(week.end, 'yyyy-MM-dd')
    );
    const personalTotal = entries
      .filter((e) => e.category?.isPersonal && e.category?.unit === 'minutes')
      .reduce((s, e) => s + e.value, 0);
    const totalActivities = entries.filter((e) => e.value > 0).length;
    const filledDays = new Set(entries.filter((e) => e.value > 0).map((e) => e.date)).size;
    return { ...week, personalTotal, totalActivities, filledDays };
  });

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
        <History className="h-5 w-5 text-[var(--theme-primary)]" />
        Historique
      </h2>

      {/* Custom period export */}
      <Card className="border-[var(--theme-primary)]">
        <CardContent className="p-3">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Exporter une période personnalisée</h3>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Date début</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs w-32 justify-start">
                    <CalendarDays className="h-3 w-3 mr-1" />
                    {selectedStart ? format(selectedStart, 'dd/MM/yyyy') : 'Choisir'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedStart}
                    onSelect={setSelectedStart}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Date fin</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs w-32 justify-start">
                    <CalendarDays className="h-3 w-3 mr-1" />
                    {selectedEnd ? format(selectedEnd, 'dd/MM/yyyy') : 'Choisir'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedEnd}
                    onSelect={setSelectedEnd}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <Button
              onClick={handleCustomExport}
              disabled={pdfLoading || !selectedStart || !selectedEnd}
              className="bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-white text-xs"
            >
              <Download className="h-3 w-3 mr-1" />
              Exporter PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick export buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => {
            const start = startOfWeek(now, { weekStartsOn: 1 });
            const end = endOfWeek(now, { weekStartsOn: 1 });
            handleExportPDF(start, end);
          }}
          disabled={pdfLoading}
        >
          <CalendarDays className="h-3 w-3 mr-1" />
          Cette semaine
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            handleExportPDF(start, end);
          }}
          disabled={pdfLoading}
        >
          <Clock className="h-3 w-3 mr-1" />
          Ce mois
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => {
            const start = new Date(now.getFullYear(), 0, 1);
            const end = new Date(now.getFullYear(), 11, 31);
            handleExportPDF(start, end);
          }}
          disabled={pdfLoading}
        >
          <TrendingUp className="h-3 w-3 mr-1" />
          Cette année
        </Button>
      </div>

      {/* Week history list */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-700">Semaines précédentes</h3>
        {weekSummaries.map((week) => {
          const isCurrentWeek =
            format(week.start, 'yyyy-MM-dd') === format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');

          return (
            <Card key={format(week.start, 'yyyy-MM-dd')} className={isCurrentWeek ? 'border-[var(--theme-primary)]' : ''}>
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    Semaine du {format(week.start, 'd MMM', { locale: fr })} au{' '}
                    {format(week.end, 'd MMM yyyy', { locale: fr })}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <Badge variant="secondary" className="text-[10px] bg-[var(--theme-primary-light)] text-[var(--theme-primary-hover)]">
                      {formatMinutes(week.personalTotal)} avec le Seigneur
                    </Badge>
                    <span className="text-[10px] text-gray-400">
                      {week.filledDays}/7 jours remplis
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs shrink-0 text-[var(--theme-primary)] border-[var(--theme-primary)]"
                  onClick={() => handleExportPDF(week.start, week.end)}
                  disabled={pdfLoading}
                >
                  <Download className="h-3 w-3 mr-1" />
                  PDF
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function History(props: React.SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </svg>
  );
}
