'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAppStore, formatMinutes, DAY_NAMES_SHORT } from '@/store/app-store';
import { useT } from '@/lib/use-t';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  TrendingUp, TrendingDown, Minus, Clock, BookOpen, ChevronLeft,
  ChevronRight, Flame, Target, BarChart3, Layers, Users, Heart,
} from 'lucide-react';
import { authFetch } from '@/lib/api';

interface DailyDataPoint {
  date: string;
  minutes: number;
  count: number;
  byCategory: Record<string, number>;
  bibleChapters?: number;
  bibleDuration?: number;
}

interface CategorySummary {
  id: string;
  name: string;
  unit: string;
  groupId: string | null;
  total: number;
}

interface ProgressionData {
  period: { startDate: string; endDate: string };
  dailyData: DailyDataPoint[];
  summary: {
    totalMinutes: number;
    totalCount: number;
    totalHours: number;
    daysWithData: number;
    avgMinutesPerDay: number;
    totalDays: number;
    categories?: CategorySummary[];
    bibleTotalChapters?: number;
    bibleTotalDuration?: number;
    bibleTotalHours?: number;
    bibleDaysWithData?: number;
    bibleAvgPerDay?: number;
  };
  groups?: { id: string; name: string }[];
  allCategories?: CategorySummary[];
}

function MiniBarChart({ data, maxValue, color = 'var(--theme-primary)', height = 80 }: {
  data: { label: string; value: number }[];
  maxValue: number;
  color?: string;
  height?: number;
}) {
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((d, i) => {
        const barHeight = maxValue > 0 ? Math.max(2, (d.value / maxValue) * (height - 20)) : 2;
        return (
          <div key={i} className="flex-1 flex flex-col items-center justify-end">
            <span className="text-[8px] text-gray-500 mb-0.5">
              {d.value > 0 ? (d.value >= 60 ? `${Math.floor(d.value / 60)}h` : `${d.value}`) : ''}
            </span>
            <div
              className="w-full rounded-t-sm transition-all duration-300"
              style={{
                height: barHeight,
                backgroundColor: d.value > 0 ? color : '#e5e7eb',
                maxWidth: '24px',
                margin: '0 auto',
              }}
            />
            <span className="text-[7px] text-gray-400 mt-0.5 truncate w-full text-center">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function ProgressionTab() {
  const period = useAppStore((s) => s.period);
  const periodType = useAppStore((s) => s.periodType);
  const setPeriodType = useAppStore((s) => s.setPeriodType);
  const nextPeriod = useAppStore((s) => s.nextPeriod);
  const prevPeriod = useAppStore((s) => s.prevPeriod);
  const goToCurrentPeriod = useAppStore((s) => s.goToCurrentPeriod);
  const t = useT();

  const [filterType, setFilterType] = useState<string>('all');
  const [filterId, setFilterId] = useState<string>('');
  const [chartView, setChartView] = useState<string>('minutes');

  const startDate = format(period.startDate, 'yyyy-MM-dd');
  const endDate = format(period.endDate, 'yyyy-MM-dd');

  const { data, isLoading } = useQuery<ProgressionData>({
    queryKey: ['progression', startDate, endDate, filterType, filterId],
    queryFn: () =>
      authFetch(`/api/progression?startDate=${startDate}&endDate=${endDate}&filterType=${filterType}&filterId=${filterId}`).then((r) => r.json()),
  });

  const summary = data?.summary || {};
  const dailyData = data?.dailyData || [];
  const groups = data?.groups || [];
  const allCategories = data?.allCategories || [];

  // Chart data
  const chartData = useMemo(() => {
    return dailyData.map((d) => {
      const dayName = DAY_NAMES_SHORT[parseInt(format(parseISO(d.date), 'i')) - 1] || format(parseISO(d.date), 'd');
      return {
        label: dayName,
        value: chartView === 'minutes' ? d.minutes : (chartView === 'bible-chapters' ? (d.bibleChapters || 0) : (chartView === 'bible-duration' ? (d.bibleDuration || 0) : d.count)),
      };
    });
  }, [dailyData, chartView]);

  const maxChartValue = Math.max(...chartData.map((d) => d.value), 1);

  // Trend: compare first half vs second half
  const trend = useMemo(() => {
    if (dailyData.length < 2) return 'neutral' as const;
    const mid = Math.floor(dailyData.length / 2);
    const firstHalf = dailyData.slice(0, mid).reduce((s, d) => s + d.minutes, 0);
    const secondHalf = dailyData.slice(mid).reduce((s, d) => s + d.minutes, 0);
    if (secondHalf > firstHalf * 1.05) return 'up' as const;
    if (secondHalf < firstHalf * 0.95) return 'down' as const;
    return 'neutral' as const;
  }, [dailyData]);

  const handleFilterTypeChange = (val: string) => {
    if (val.startsWith('group:')) {
      setFilterType('group');
      setFilterId(val.split(':')[1]);
    } else {
      setFilterType(val);
      setFilterId('');
    }
  };

  // Filter label
  const filterLabel = useMemo(() => {
    if (filterType === 'all') return t('progression.allActivities');
    if (filterType === 'time-with-god') return t('progression.timeWithGod');
    if (filterType === 'bible') return t('progression.bibleReading');
    if (filterType === 'group' && filterId) {
      const g = groups.find((g) => g.id === filterId);
      return g?.name || '';
    }
    if (filterType === 'category' && filterId) {
      const c = allCategories.find((c) => c.id === filterId);
      return c?.name || '';
    }
    return '';
  }, [filterType, filterId, groups, allCategories, t]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-3/4" />
          <div className="h-24 bg-gray-200 rounded" />
          <div className="h-32 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      {/* Period selector */}
      <Card className="border-[var(--theme-primary)]">
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevPeriod}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" className="text-[10px] h-7 px-2" onClick={goToCurrentPeriod}>{t('period.today')}</Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextPeriod}><ChevronRight className="h-4 w-4" /></Button>
            </div>
            <div className="flex gap-1">
              {(['week', 'month', 'year'] as const).map((pt) => (
                <Button
                  key={pt}
                  size="sm"
                  variant={periodType === pt ? 'default' : 'ghost'}
                  className={`text-[10px] h-7 px-2 ${periodType === pt ? 'bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-white' : ''}`}
                  onClick={() => setPeriodType(pt)}
                >
                  {t(`period.${pt}`)}
                </Button>
              ))}
            </div>
          </div>
          <p className="text-xs text-gray-600 text-center font-medium">{period.label}</p>
        </CardContent>
      </Card>

      {/* Filter selector */}
      <Card>
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[var(--theme-primary)]" />
            <h3 className="text-sm font-semibold text-gray-700 flex-1">{t('progression.viewProgression')}</h3>
          </div>
          <div className="flex gap-2">
            <Select value={filterType} onValueChange={handleFilterTypeChange}>
              <SelectTrigger className="flex-1 h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  <div className="flex items-center gap-1"><Layers className="h-3 w-3" /> {t('progression.allActivities')}</div>
                </SelectItem>
                <SelectItem value="time-with-god" className="text-xs">
                  <div className="flex items-center gap-1"><Heart className="h-3 w-3" /> {t('progression.timeWithGod')}</div>
                </SelectItem>
                <SelectItem value="bible" className="text-xs">
                  <div className="flex items-center gap-1"><BookOpen className="h-3 w-3" /> {t('progression.bibleReading')}</div>
                </SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={`group:${g.id}`} className="text-xs">
                    <div className="flex items-center gap-1"><Users className="h-3 w-3" /> {g.name}</div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filterLabel && (
            <Badge variant="secondary" className="text-[10px] bg-[var(--theme-primary-light)] text-[var(--theme-primary)]">
              {filterLabel}
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* Main stats */}
        <Card className="border-[var(--theme-primary)] bg-[var(--theme-primary-light)]">
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Clock className="h-4 w-4 text-[var(--theme-primary)]" />
              <p className="text-[10px] text-gray-600">{t('progression.totalTime')}</p>
            </div>
            <p className="text-xl font-bold text-[var(--theme-primary)]">{formatMinutes(summary.totalMinutes || 0)}</p>
            <p className="text-[10px] text-gray-500">{summary.totalHours || 0}h {t('common.min').toLowerCase()}</p>
          </CardContent>
        </Card>

        <Card className="border-[var(--theme-primary)] bg-[var(--theme-primary-light)]">
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Target className="h-4 w-4 text-[var(--theme-primary)]" />
              <p className="text-[10px] text-gray-600">{t('progression.daysActive')}</p>
            </div>
            <p className="text-xl font-bold text-[var(--theme-primary)]">{summary.daysWithData || 0}<span className="text-sm text-gray-400">/{summary.totalDays || 0}</span></p>
            <p className="text-[10px] text-gray-500">
              {summary.totalDays > 0 ? Math.round(((summary.daysWithData || 0) / (summary.totalDays || 1)) * 100) : 0}%
            </p>
          </CardContent>
        </Card>

        {/* Average */}
        <Card className="border-[var(--theme-primary)] bg-[var(--theme-primary-light)]">
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Flame className="h-4 w-4 text-[var(--theme-primary)]" />
              <p className="text-[10px] text-gray-600">{t('progression.avgPerDay')}</p>
            </div>
            <p className="text-xl font-bold text-[var(--theme-primary)]">{formatMinutes(summary.avgMinutesPerDay || 0)}</p>
            <p className="text-[10px] text-gray-500">{t('progression.perActiveDay')}</p>
          </CardContent>
        </Card>

        {/* Trend */}
        <Card className="border-[var(--theme-primary)] bg-[var(--theme-primary-light)]">
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              {trend === 'up' ? <TrendingUp className="h-4 w-4 text-green-500" /> : trend === 'down' ? <TrendingDown className="h-4 w-4 text-red-500" /> : <Minus className="h-4 w-4 text-gray-400" />}
              <p className="text-[10px] text-gray-600">{t('progression.trend')}</p>
            </div>
            <p className="text-xl font-bold" style={{ color: trend === 'up' ? '#22c55e' : trend === 'down' ? '#ef4444' : '#9ca3af' }}>
              {trend === 'up' ? t('progression.trendUp') : trend === 'down' ? t('progression.trendDown') : t('progression.trendStable')}
            </p>
            <p className="text-[10px] text-gray-500">{t('progression.halfPeriod')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Bible summary (when filter is all or bible) */}
      {(filterType === 'all' || filterType === 'bible') && (
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <BookOpen className="h-4 w-4 text-blue-500" />
                <p className="text-[10px] text-gray-600">{t('progression.bibleChapters')}</p>
              </div>
              <p className="text-xl font-bold text-blue-600">{summary.bibleTotalChapters || 0}</p>
              <p className="text-[10px] text-gray-500">{t('progression.chaptersRead')}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Clock className="h-4 w-4 text-blue-500" />
                <p className="text-[10px] text-gray-600">{t('progression.readingTime')}</p>
              </div>
              <p className="text-xl font-bold text-blue-600">{formatMinutes(summary.bibleTotalDuration || 0)}</p>
              <p className="text-[10px] text-gray-500">{summary.bibleTotalHours || 0}h</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Chart section */}
      <Card>
        <CardContent className="p-3 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[var(--theme-primary)]" />
              {t('progression.dailyChart')}
            </h3>
          </div>

          {/* Chart type tabs */}
          <Tabs value={chartView} onValueChange={setChartView} className="w-full">
            <TabsList className="grid w-full grid-cols-4 h-8">
              <TabsTrigger value="minutes" className="text-[10px] gap-0.5"><Clock className="h-2.5 w-2.5" /> {t('common.min').toLowerCase()}</TabsTrigger>
              <TabsTrigger value="count" className="text-[10px]">{t('activities.count')}</TabsTrigger>
              <TabsTrigger value="bible-chapters" className="text-[10px] gap-0.5"><BookOpen className="h-2.5 w-2.5" /> ch.</TabsTrigger>
              <TabsTrigger value="bible-duration" className="text-[10px]">⏱ min</TabsTrigger>
            </TabsList>

            <TabsContent value={chartView} className="mt-3">
              {dailyData.length > 0 ? (
                <MiniBarChart
                  data={chartData}
                  maxValue={maxChartValue}
                  color={chartView.includes('bible') ? '#3b82f6' : 'var(--theme-primary)'}
                  height={100}
                />
              ) : (
                <p className="text-xs text-gray-400 text-center py-8">{t('common.noData')}</p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Per-category breakdown */}
      {(filterType === 'all' || filterType === 'time-with-god') && (summary.categories?.length || 0) > 0 && (
        <Card>
          <CardContent className="p-3 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Layers className="h-4 w-4 text-[var(--theme-primary)]" />
              {t('progression.perActivity')}
            </h3>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {summary.categories!.map((cat) => {
                const maxTotal = Math.max(...summary.categories!.map((c) => c.total), 1);
                const pct = Math.round((cat.total / maxTotal) * 100);
                return (
                  <div key={cat.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-700 truncate flex-1">{cat.name}</span>
                      <span className="text-xs font-medium text-[var(--theme-primary)] ml-2">
                        {cat.unit === 'minutes' ? formatMinutes(cat.total) : `${cat.total}`}
                      </span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daily detail */}
      <Card>
        <CardContent className="p-3 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[var(--theme-primary)]" />
            {t('progression.dailyDetail')}
          </h3>
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {dailyData.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">{t('common.noData')}</p>
            )}
            {dailyData.map((d) => {
              const dayIndex = parseInt(format(parseISO(d.date), 'i')) - 1;
              const dayName = DAY_NAMES_SHORT[dayIndex >= 0 ? dayIndex : 0];
              const isActive = d.minutes > 0 || d.count > 0 || (d.bibleChapters || 0) > 0;
              return (
                <div
                  key={d.date}
                  className={`flex items-center gap-2 p-2 rounded-lg text-xs ${isActive ? 'bg-[var(--theme-primary-light)] border border-[var(--theme-primary)]' : 'bg-gray-50 border border-gray-100'}`}
                >
                  <span className="w-10 text-gray-600 font-medium">{dayName}</span>
                  <span className="w-12 text-gray-500">{format(parseISO(d.date), 'd MMM', { locale: fr })}</span>
                  <div className="flex-1 flex items-center gap-2">
                    {d.minutes > 0 && (
                      <Badge variant="secondary" className="text-[10px] bg-[var(--theme-primary)] text-white">
                        <Clock className="h-2 w-2 mr-0.5" />{formatMinutes(d.minutes)}
                      </Badge>
                    )}
                    {d.count > 0 && (
                      <Badge variant="secondary" className="text-[10px] bg-[var(--theme-primary-hover)] text-white">
                        {d.count}
                      </Badge>
                    )}
                    {(d.bibleChapters || 0) > 0 && (
                      <Badge variant="secondary" className="text-[10px] bg-blue-500 text-white">
                        <BookOpen className="h-2 w-2 mr-0.5" />{d.bibleChapters} ch.
                      </Badge>
                    )}
                    {(d.bibleDuration || 0) > 0 && (
                      <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-700">
                        ⏱{formatMinutes(d.bibleDuration)}
                      </Badge>
                    )}
                    {!isActive && <span className="text-gray-300">—</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
