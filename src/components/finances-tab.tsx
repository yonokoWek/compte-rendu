'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, ArrowUpCircle, ArrowDownCircle, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '@/lib/api';

interface FinanceEntry {
  id: string;
  date: string;
  type: string;
  label: string;
  amount: number;
  category: string;
}

export default function FinancesTab() {
  const period = useAppStore((s) => s.period);
  const queryClient = useQueryClient();
  const [newLabel, setNewLabel] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newType, setNewType] = useState<'income' | 'expense'>('income');
  const [newCategory, setNewCategory] = useState('');
  const [filter, setFilter] = useState('all');

  const { data: entries = [] } = useQuery<FinanceEntry[]>({
    queryKey: ['finances', period.startDate, period.endDate],
    queryFn: () =>
      authFetch(
        `/api/finances?startDate=${format(period.startDate, 'yyyy-MM-dd')}&endDate=${format(period.endDate, 'yyyy-MM-dd')}`
      ).then((r) => r.json()),
  });

  const addEntry = useMutation({
    mutationFn: (data: { date: string; type: string; label: string; amount: number; category: string }) =>
      authFetch('/api/finances', {
        method: 'POST',
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finances'] });
      setNewLabel('');
      setNewAmount('');
      setNewCategory('');
    },
  });

  const deleteEntry = useMutation({
    mutationFn: (id: string) => authFetch(`/api/finances?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['finances'] }),
  });

  const totalIncome = entries
    .filter((e) => e.type === 'income')
    .reduce((s, e) => s + e.amount, 0);
  const totalExpense = entries
    .filter((e) => e.type === 'expense')
    .reduce((s, e) => s + e.amount, 0);
  const balance = totalIncome - totalExpense;

  const filteredEntries = entries.filter((e) => {
    if (filter === 'all') return true;
    if (filter === 'income') return e.type === 'income';
    if (filter === 'expense') return e.type === 'expense' && e.category !== 'epargne' && e.category !== 'don';
    if (filter === 'epargne') return e.category === 'epargne';
    if (filter === 'don') return e.category === 'don';
    return true;
  });

  const formatAmount = (amount: number) => {
    return amount.toLocaleString('fr-FR') + ' F';
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-3 text-center">
            <ArrowUpCircle className="h-4 w-4 text-green-600 mx-auto mb-1" />
            <p className="text-lg font-bold text-green-600">{formatAmount(totalIncome)}</p>
            <p className="text-[10px] text-gray-600">Entrées</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-3 text-center">
            <ArrowDownCircle className="h-4 w-4 text-red-600 mx-auto mb-1" />
            <p className="text-lg font-bold text-red-600">{formatAmount(totalExpense)}</p>
            <p className="text-[10px] text-gray-600">Sorties</p>
          </CardContent>
        </Card>
        <Card className="border-[var(--theme-primary)] bg-[var(--theme-primary-light)]">
          <CardContent className="p-3 text-center">
            <Wallet className="h-4 w-4 text-[var(--theme-primary)] mx-auto mb-1" />
            <p className="text-lg font-bold text-[var(--theme-primary)]">{formatAmount(balance)}</p>
            <p className="text-[10px] text-gray-600">Solde</p>
          </CardContent>
        </Card>
      </div>

      {/* Add transaction */}
      <Card className="border-[var(--theme-primary)]">
        <CardContent className="p-3 space-y-2">
          <div className="flex gap-2">
            <Select value={newType} onValueChange={(v) => setNewType(v as 'income' | 'expense')}>
              <SelectTrigger className="w-28 h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Entrée</SelectItem>
                <SelectItem value="expense">Sortie</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Libellé (ex: essence, salaire...)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="flex-1 h-9 text-sm"
            />
            <Input
              placeholder="Montant"
              type="number"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              className="w-28 h-9 text-sm"
            />
          </div>
          {newType === 'expense' && (
            <Select value={newCategory} onValueChange={setNewCategory}>
              <SelectTrigger className="w-full h-8 text-xs">
                <SelectValue placeholder="Catégorie (optionnel)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="epargne">Épargne</SelectItem>
                <SelectItem value="don">Don à Dieu</SelectItem>
                <SelectItem value="autre">Autre</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Button
            onClick={() => {
              if (!newLabel.trim() || !newAmount) return;
              addEntry.mutate({
                date: format(new Date(), 'yyyy-MM-dd'),
                type: newType,
                label: newLabel,
                amount: parseInt(newAmount),
                category: newCategory,
              });
              toast.success('Transaction ajoutée');
            }}
            disabled={!newLabel.trim() || !newAmount || addEntry.isPending}
            className="w-full bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-white text-xs"
          >
            <Plus className="h-3 w-3 mr-1" />
            Ajouter une transaction
          </Button>
        </CardContent>
      </Card>

      {/* Filter and list */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Transactions</h3>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-28 h-7 text-[10px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tout</SelectItem>
                <SelectItem value="income">Entrées</SelectItem>
                <SelectItem value="expense">Sorties</SelectItem>
                <SelectItem value="epargne">Épargne</SelectItem>
                <SelectItem value="don">Don à Dieu</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {filteredEntries.length === 0 && (
              <p className="text-center text-xs text-gray-400 py-4">Aucune transaction</p>
            )}
            {filteredEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  entry.type === 'income' ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  {entry.type === 'income' ? (
                    <ArrowUpCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <ArrowDownCircle className="h-4 w-4 text-red-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{entry.label}</p>
                  <p className="text-[10px] text-gray-400">
                    {format(new Date(entry.date), 'dd/MM', { locale: fr })}
                    {entry.category ? ` • ${entry.category}` : ''}
                  </p>
                </div>
                <p className={`text-sm font-semibold shrink-0 ${
                  entry.type === 'income' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {entry.type === 'income' ? '+' : '-'}{formatAmount(entry.amount)}
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-6 w-6 text-gray-300 hover:text-red-500"
                  onClick={() => {
                    deleteEntry.mutate(entry.id);
                    toast.success('Transaction supprimée');
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
