'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, getDay } from 'date-fns';
import { useAppStore, DAY_NAMES_SHORT, getDaysInRange } from '@/store/app-store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Trash2,
  FolderPlus,
  FolderOpen,
  X,
  ArrowRight,
  CheckSquare,
  Timer,
  TrendingUp,
  Settings,
} from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '@/lib/api';

// === Report Activity Types ===
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

// === Custom Activity Types ===
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

  // === Report Activity Management State ===
  const [newGroupName, setNewGroupName] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [newCatUnit, setNewCatUnit] = useState('minutes');
  const [newCatPersonal, setNewCatPersonal] = useState(true);

  // === Custom Activity State ===
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('circle');
  const [newTrackMode, setNewTrackMode] = useState('count');

  // === Report Activity Queries & Mutations ===
  const { data: catData } = useQuery<{
    categories: Category[];
    groups: Group[];
  }>({
    queryKey: ['categories'],
    queryFn: () => authFetch('/api/categories').then((r) => r.json()),
  });
  const categories = catData?.categories || [];
  const groups = catData?.groups || [];

  const addCategory = useMutation({
    mutationFn: (data: { type: 'category'; name: string; unit: string; isPersonal: boolean; groupId?: string }) =>
      authFetch('/api/categories', { method: 'POST', body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categories'] }); setNewCatName(''); },
  });

  const deleteCategory = useMutation({
    mutationFn: (id: string) => authFetch(`/api/categories?type=category&id=${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  });

  const addGroup = useMutation({
    mutationFn: (name: string) =>
      authFetch('/api/categories', { method: 'POST', body: JSON.stringify({ type: 'group', name }) }).then((r) => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categories'] }); setNewGroupName(''); toast.success('Groupe créé'); },
  });

  const deleteGroup = useMutation({
    mutationFn: (id: string) => authFetch(`/api/categories?type=group&id=${id}`, { method: 'DELETE' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categories'] }); toast.success('Groupe supprimé'); },
  });

  const assignToGroup = useMutation({
    mutationFn: (data: { type: 'assign'; categoryId: string; groupId: string | null }) =>
      authFetch('/api/categories', { method: 'POST', body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categories'] }); toast.success('Activité déplacée'); },
  });

  // === Custom Activity Queries & Mutations ===
  const { data: activities = [] } = useQuery<CustomActivity[]>({
    queryKey: ['activities'],
    queryFn: () => authFetch('/api/activities').then((r) => r.json()),
  });

  const { data: logs = [] } = useQuery<ActivityLog[]>({
    queryKey: ['activity-logs', period.startDate, period.endDate],
    queryFn: () =>
      authFetch(
        `/api/activity-logs?startDate=${format(period.startDate, 'yyyy-MM-dd')}&endDate=${format(period.endDate, 'yyyy-MM-dd')}`
      ).then((r) => r.json()),
  });

  const addActivity = useMutation({
    mutationFn: (data: { name: string; icon: string; trackMode: string }) =>
      authFetch('/api/activities', {
        method: 'POST',
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      setNewName('');
    },
  });

  const deleteActivity = useMutation({
    mutationFn: (id: string) => authFetch(`/api/activities?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['activities'] }),
  });

  const toggleLog = useMutation({
    mutationFn: (data: { date: string; activityId: string; completed: boolean }) =>
      authFetch('/api/activity-logs', {
        method: 'POST',
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['activity-logs'] }),
  });

  // === Custom Activity Helpers ===
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
      <Tabs defaultValue="report">
        <TabsList className="w-full">
          <TabsTrigger value="report" className="flex-1 gap-1.5">
            <Settings className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Activités de rapport</span>
            <span className="sm:hidden">Rapport</span>
          </TabsTrigger>
          <TabsTrigger value="daily" className="flex-1 gap-1.5">
            <CheckSquare className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Suivi quotidien</span>
            <span className="sm:hidden">Quotidien</span>
          </TabsTrigger>
        </TabsList>

        {/* ===== Sub-tab 1: Activités de rapport ===== */}
        <TabsContent value="report">
          <div className="space-y-4">
            <p className="text-xs text-gray-500">
              Gérez les groupes et activités du compte rendu.
              Seules les activités groupées apparaîtront sur le PDF.
            </p>

            {/* Create group */}
            <Card className="border-[var(--theme-primary)]">
              <CardContent className="p-3 space-y-2">
                <h4 className="text-xs font-semibold text-gray-700">Créer un groupe</h4>
                <div className="flex gap-2">
                  <Input placeholder="Nom du groupe" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} className="text-sm flex-1" />
                  <Button onClick={() => { if (newGroupName.trim()) addGroup.mutate(newGroupName); }} disabled={!newGroupName.trim() || addGroup.isPending} size="sm" className="bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-white text-xs">
                    <FolderPlus className="h-3 w-3 mr-1" /> Créer
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Existing groups */}
            {groups.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-700">Groupes existants</h4>
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {groups.map((group) => (
                    <Card key={group.id} className="border-l-4 border-l-[var(--theme-primary)]">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <FolderOpen className="h-4 w-4 text-[var(--theme-primary)]" />
                            <span className="text-sm font-semibold">{group.name}</span>
                            <span className="text-[10px] text-gray-400">({group.categories.length} activités)</span>
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-red-500" onClick={() => deleteGroup.mutate(group.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {group.categories.map((cat) => (
                            <span key={cat.id} className="inline-flex items-center gap-1 text-[10px] bg-[var(--theme-primary-light)] text-[var(--theme-primary-hover)] px-2 py-0.5 rounded-full">
                              {cat.name}
                              <button onClick={() => assignToGroup.mutate({ type: 'assign', categoryId: cat.id, groupId: null })} className="hover:text-red-500">
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </span>
                          ))}
                          {group.categories.length === 0 && (
                            <span className="text-[10px] text-gray-400 italic">Aucune activité assignée</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Add new category */}
            <Card className="border-gray-200">
              <CardContent className="p-3 space-y-2">
                <h4 className="text-xs font-semibold text-gray-700">Ajouter une activité</h4>
                <div className="flex gap-2">
                  <Input placeholder="Nom de l'activité" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} className="text-sm flex-1" />
                  <Select value={newCatUnit} onValueChange={setNewCatUnit}>
                    <SelectTrigger className="w-24 h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minutes">Minutes</SelectItem>
                      <SelectItem value="count">Compté</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-gray-500 flex items-center gap-1">
                    <input type="checkbox" checked={newCatPersonal} onChange={(e) => setNewCatPersonal(e.target.checked)} className="rounded" />
                    Personnel (compté dans le total)
                  </label>
                </div>
                <Button onClick={() => { if (newCatName.trim()) addCategory.mutate({ type: 'category', name: newCatName, unit: newCatUnit, isPersonal: newCatPersonal }); }} disabled={!newCatName.trim()} size="sm" className="bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-white text-xs">
                  <Plus className="h-3 w-3 mr-1" /> Ajouter
                </Button>
              </CardContent>
            </Card>

            {/* All categories with assign/delete */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-gray-700">Toutes les activités</h4>
              <div className="max-h-96 overflow-y-auto space-y-1">
                {categories.map((cat) => (
                  <div key={cat.id} className="flex items-center justify-between p-2 rounded-lg border border-gray-100 bg-white hover:bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{cat.name}</p>
                      <p className="text-[10px] text-gray-400">
                        {cat.unit === 'minutes' ? 'min' : 'Part.'}
                        {cat.isPersonal ? ' • Personnel' : ''}
                        {cat.group ? ` • 📁 ${cat.group.name}` : ' • Non groupé'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-6 text-gray-400">
                            <ArrowRight className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {groups.map((g) => (
                            <DropdownMenuItem key={g.id} onClick={() => assignToGroup.mutate({ type: 'assign', categoryId: cat.id, groupId: g.id })}>
                              <FolderOpen className="h-3 w-3 mr-2" />
                              {g.name}
                              {cat.groupId === g.id && ' ✓'}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => assignToGroup.mutate({ type: 'assign', categoryId: cat.id, groupId: null })}>
                            <X className="h-3 w-3 mr-2" />
                            Retirer du groupe
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-red-500" onClick={() => { deleteCategory.mutate(cat.id); toast.success('Activité supprimée'); }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ===== Sub-tab 2: Suivi quotidien ===== */}
        <TabsContent value="daily">
          <div className="space-y-4">
            {/* Add activity */}
            <Card className="border-[var(--theme-primary)]">
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
                    className="bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-white text-xs shrink-0"
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
                              className="h-full bg-[var(--theme-primary)] rounded-full transition-all"
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
                                  ? 'bg-[var(--theme-primary)] text-white'
                                  : 'bg-gray-100 text-gray-600 hover:bg-[var(--theme-primary-light)]'
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
