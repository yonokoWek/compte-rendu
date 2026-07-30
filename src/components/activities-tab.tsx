'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, eachDayOfInterval, getDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAppStore, DAY_NAMES_SHORT, getDaysInRange } from '@/store/app-store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Timer, CheckSquare, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

interface CustomActivity {
  id: string;
  name: string;
  icon: string;
  trackMode: string;
}

interface ActivityLog {
  id: string;
  date: string;
  activityId: string;
  completed: boolean;
  duration: number;
}

const ICON_OPTIONS = [
  { value: 'circle', label: '●' },
  { value: 'star', label: '★' },
  { value: 'heart', label: '♥' },
  { value: 'flame', label: '🔥' },
  { value: 'book', label: '📖' },
  { value: 'cross', label: '✝' },
  { value: 'check', label: '✓' },
  { value: 'arrow', label: '→' },
];

export default function ActivitiesTab() {
  const period = useAppStore((s) => s.period);
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('circle');
  const [newTrackMode, setNewTrackMode] = useState('count');

  const { data: activities = [] } = useQuery<CustomActivity[]>({
    queryKey: ['activities'],
    queryFn: () => fetch('/api/activities').then((r) => r.json()),
  });

  const { data: logs = [] } = useQuery<ActivityLog[]>({
    queryKey: ['activity-logs', period.startDate, period.endDate],
    queryFn: () =>
      fetch(
        `/api/activity-logs?startDate=${format(period.startDate, 'yyyy-MM-dd')}&endDate=${format(period.endDate, 'yyyy-MM-dd')}`
      ).then((r) => r.json()),
  });

  const addActivity = useMutation({
    mutationFn: (data: { name: string; icon: string; trackMode: string }) =>
      fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      setNewName('');
    },
  });

  const deleteActivity = useMutation({
    mutationFn: (id: string) => fetch(`/api/activities?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['activities'] }),
  });

  const toggleLog = useMutation({
    mutationFn: (data: { date: string; activityId: string; completed: boolean }) =>
      fetch('/api/activity-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['activity-logs'] }),
  });

  // Log map
  const logMap: Record<string, boolean> = {};
  for (const log of logs) {
    logMap[`${log.date}_${log.activityId}`] = log.completed;
  }

  const days = getDaysInRange(period.startDate, period.endDate);

  const getCompletionRate = (activityId: string) => {
    const total = days.length;
    const completed = days.filter((d) => logMap[`${format(d, 'yyyy-MM-dd')}_${activityId}`]).length;
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      {/* Add activity */}
      <Card className="border-orange-200">
        <CardContent className="p-3 space-y-2">
          <Input
            placeholder="Nouvelle activité (ex: Proclamation, Lecture Biblique...)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newName.trim()) {
                addActivity.mutate({ name: newName, icon: newIcon, trackMode: newTrackMode });
              }
            }}
            className="text-sm"
          />
          <div className="flex gap-2">
            <Select value={newTrackMode} onValueChange={setNewTrackMode}>
              <SelectTrigger className="flex-1 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="count">
                  <span className="flex items-center gap-1"><CheckSquare className="h-3 w-3" /> Compté</span>
                </SelectItem>
                <SelectItem value="timer">
                  <span className="flex items-center gap-1"><Timer className="h-3 w-3" /> Chrono</span>
                </SelectItem>
              </SelectContent>
            </Select>
            <Select value={newIcon} onValueChange={setNewIcon}>
              <SelectTrigger className="w-16 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ICON_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => {
                if (newName.trim()) {
                  addActivity.mutate({ name: newName, icon: newIcon, trackMode: newTrackMode });
                  toast.success('Activité ajoutée');
                }
              }}
              disabled={!newName.trim() || addActivity.isPending}
              className="bg-orange-600 hover:bg-orange-700 text-white text-xs shrink-0"
            >
              <Plus className="h-3 w-3 mr-1" />
              Ajouter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Activity list */}
      {activities.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Aucune activité créée</p>
          <p className="text-xs mt-1">Ajoutez vos activités à suivre</p>
        </div>
      )}

      <div className="space-y-3">
        {activities.map((activity) => {
          const rate = getCompletionRate(activity.id);
          const iconObj = ICON_OPTIONS.find((i) => i.value === activity.icon);
          return (
            <Card key={activity.id}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{iconObj?.label || '●'}</span>
                    <div>
                      <p className="text-sm font-medium">{activity.name}</p>
                      <p className="text-[10px] text-gray-400">
                        {activity.trackMode === 'count' ? 'Compté' : 'Chrono'} • {rate}%
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Progress bar */}
                    <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-500 rounded-full transition-all"
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-gray-400 hover:text-red-500"
                      onClick={() => deleteActivity.mutate(activity.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Daily checkoff */}
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {days.map((day) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const dayIndex = getDay(day);
                    const adjustedIndex = dayIndex === 0 ? 6 : dayIndex - 1;
                    const isChecked = logMap[`${dateStr}_${activity.id}`] || false;

                    return (
                      <button
                        key={dateStr}
                        onClick={() => toggleLog.mutate({ date: dateStr, activityId: activity.id, completed: !isChecked })}
                        className={`flex flex-col items-center min-w-[36px] p-1 rounded-lg text-[10px] transition-colors ${
                          isChecked
                            ? 'bg-orange-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-orange-100'
                        }`}
                      >
                        <span className="font-semibold">{DAY_NAMES_SHORT[adjustedIndex]}</span>
                        <span>{format(day, 'd')}</span>
                        {isChecked && <CheckSquare className="h-3 w-3 mt-0.5" />}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
