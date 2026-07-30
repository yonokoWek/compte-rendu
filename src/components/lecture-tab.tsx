'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Check, BookOpen, Book } from 'lucide-react';
import { toast } from 'sonner';

interface Book {
  id: string;
  title: string;
  author: string;
  totalChapters: number;
  currentChapter: number;
  status: string;
  chapterLogs: { id: string; date: string; chapters: number }[];
}

interface BibleLog {
  id: string;
  date: string;
  chapters: number;
}

interface PrayerNeed {
  id: string;
  text: string;
  resolved: boolean;
}

export default function LectureTab() {
  const period = useAppStore((s) => s.period);
  const queryClient = useQueryClient();
  const [newBookTitle, setNewBookTitle] = useState('');
  const [newBookAuthor, setNewBookAuthor] = useState('');
  const [newBookChapters, setNewBookChapters] = useState('');
  const [newPrayerText, setNewPrayerText] = useState('');
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [chapterInput, setChapterInput] = useState<Record<string, string>>({});

  // Fetch books
  const { data: books = [] } = useQuery<Book[]>({
    queryKey: ['books'],
    queryFn: () => fetch('/api/books').then((r) => r.json()),
  });

  // Fetch bible logs
  const { data: bibleLogs = [] } = useQuery<BibleLog[]>({
    queryKey: ['bible', period.startDate, period.endDate],
    queryFn: () =>
      fetch(
        `/api/bible?startDate=${format(period.startDate, 'yyyy-MM-dd')}&endDate=${format(period.endDate, 'yyyy-MM-dd')}`
      ).then((r) => r.json()),
  });

  // Fetch prayers
  const { data: prayers = [] } = useQuery<PrayerNeed[]>({
    queryKey: ['prayers'],
    queryFn: () => fetch('/api/prayers').then((r) => r.json()),
  });

  // Mutations
  const addBook = useMutation({
    mutationFn: (data: { title: string; author: string; totalChapters: number }) =>
      fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['books'] });
      setNewBookTitle('');
      setNewBookAuthor('');
      setNewBookChapters('');
    },
  });

  const deleteBook = useMutation({
    mutationFn: (id: string) => fetch(`/api/books?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['books'] }),
  });

  const saveBibleLog = useMutation({
    mutationFn: (data: { date: string; chapters: number }) =>
      fetch('/api/bible', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bible'] }),
  });

  const addPrayer = useMutation({
    mutationFn: (text: string) =>
      fetch('/api/prayers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prayers'] });
      setNewPrayerText('');
    },
  });

  const togglePrayer = useMutation({
    mutationFn: (data: { id: string; resolved: boolean }) =>
      fetch('/api/prayers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['prayers'] }),
  });

  const deletePrayer = useMutation({
    mutationFn: (id: string) => fetch(`/api/prayers?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['prayers'] }),
  });

  const bibleLogMap: Record<string, number> = {};
  for (const log of bibleLogs) {
    bibleLogMap[log.date] = log.chapters;
  }

  const totalBibleChapters = Object.values(bibleLogMap).reduce((s, v) => s + v, 0);

  const activeBooks = books.filter((b) => b.status === 'in_progress');
  const finishedBooks = books.filter((b) => b.status === 'finished');

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <Tabs defaultValue="livres" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="livres" className="text-xs gap-1">
            <Book className="h-3 w-3" />
            Livres
          </TabsTrigger>
          <TabsTrigger value="bible" className="text-xs gap-1">
            <BookOpen className="h-3 w-3" />
            Bible
          </TabsTrigger>
          <TabsTrigger value="prieres" className="text-xs gap-1">
            ❤️
            Prières
          </TabsTrigger>
        </TabsList>

        {/* Livres Tab */}
        <TabsContent value="livres" className="space-y-4 mt-4">
          {/* Stats */}
          <div className="flex gap-3">
            <Card className="flex-1 border-orange-200 bg-orange-50">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-orange-600">{books.length}</p>
                <p className="text-xs text-gray-600">Total livres</p>
              </CardContent>
            </Card>
            <Card className="flex-1 border-orange-200 bg-orange-50">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-orange-600">
                  {books.reduce((s, b) => s + b.currentChapter, 0)}
                </p>
                <p className="text-xs text-gray-600">Chapitres lus</p>
              </CardContent>
            </Card>
          </div>

          {/* Add book */}
          <Card>
            <CardContent className="p-3 space-y-2">
              <Input
                placeholder="Titre du livre"
                value={newBookTitle}
                onChange={(e) => setNewBookTitle(e.target.value)}
                className="text-sm"
              />
              <div className="flex gap-2">
                <Input
                  placeholder="Auteur"
                  value={newBookAuthor}
                  onChange={(e) => setNewBookAuthor(e.target.value)}
                  className="text-sm flex-1"
                />
                <Input
                  placeholder="Nb chapitres"
                  type="number"
                  value={newBookChapters}
                  onChange={(e) => setNewBookChapters(e.target.value)}
                  className="text-sm w-24"
                />
              </div>
              <Button
                onClick={() => {
                  if (!newBookTitle.trim()) return;
                  addBook.mutate({
                    title: newBookTitle,
                    author: newBookAuthor,
                    totalChapters: parseInt(newBookChapters) || 0,
                  });
                }}
                disabled={!newBookTitle.trim() || addBook.isPending}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                Ajouter un livre
              </Button>
            </CardContent>
          </Card>

          {/* Active books */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">📚 Livres en cours</h3>
            {activeBooks.length === 0 && (
              <p className="text-xs text-gray-400 italic">Aucun livre en cours</p>
            )}
            {activeBooks.map((book) => (
              <Card key={book.id} className="border-l-4 border-l-orange-400">
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{book.title}</p>
                    <p className="text-xs text-gray-500">
                      {book.author && `${book.author} • `}
                      {book.currentChapter}/{book.totalChapters || '?'} chap.
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-gray-400 hover:text-red-500 shrink-0"
                    onClick={() => deleteBook.mutate(book.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Finished books */}
          {finishedBooks.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-700">✅ Livres terminés</h3>
              {finishedBooks.map((book) => (
                <Card key={book.id} className="border-l-4 border-l-green-400 opacity-75">
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{book.title}</p>
                      <p className="text-xs text-gray-500">{book.author}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-gray-400 hover:text-red-500 shrink-0"
                      onClick={() => deleteBook.mutate(book.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Bible Tab */}
        <TabsContent value="bible" className="space-y-4 mt-4">
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-gray-600">Total chapitres cette semaine</p>
              <p className="text-3xl font-bold text-orange-600">{totalBibleChapters}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Chapitres lus par jour</h3>
              <div className="space-y-2">
                {[0, 1, 2, 3, 4, 5, 6].map((offset) => {
                  const date = new Date(period.startDate);
                  date.setDate(date.getDate() + offset);
                  if (date > period.endDate) return null;
                  const dateStr = format(date, 'yyyy-MM-dd');
                  const dayName = format(date, 'EEEE', { locale: fr });
                  return (
                    <div key={dateStr} className="flex items-center gap-2">
                      <span className="text-xs text-gray-600 w-20 capitalize">{dayName.slice(0, 3)}</span>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={chapterInput[dateStr] ?? bibleLogMap[dateStr] ?? ''}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setChapterInput((prev) => ({ ...prev, [dateStr]: e.target.value }));
                          saveBibleLog.mutate({ date: dateStr, chapters: val });
                        }}
                        className="flex-1 h-8 text-sm text-center"
                      />
                      <span className="text-[10px] text-gray-400">ch.</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Prières Tab */}
        <TabsContent value="prieres" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-3">
              {prayers.length === 0 && (
                <div className="text-center py-6 text-gray-400">
                  <p className="text-sm">Aucun besoin de prière</p>
                </div>
              )}
              <div className="space-y-2">
                {prayers.map((prayer) => (
                  <div
                    key={prayer.id}
                    className={`flex items-start gap-2 p-2 rounded-lg border ${
                      prayer.resolved ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'
                    }`}
                  >
                    <button
                      onClick={() => togglePrayer.mutate({ id: prayer.id, resolved: !prayer.resolved })}
                      className={`mt-0.5 shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center ${
                        prayer.resolved
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-gray-300'
                      }`}
                    >
                      {prayer.resolved && <Check className="h-3 w-3" />}
                    </button>
                    <p className={`text-sm flex-1 ${prayer.resolved ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                      {prayer.text}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-6 w-6 text-gray-400 hover:text-red-500"
                      onClick={() => deletePrayer.mutate(prayer.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Add prayer */}
          <div className="flex gap-2">
            <Input
              placeholder="Ajouter un besoin de prière..."
              value={newPrayerText}
              onChange={(e) => setNewPrayerText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newPrayerText.trim()) {
                  addPrayer.mutate(newPrayerText);
                }
              }}
              className="text-sm"
            />
            <Button
              onClick={() => {
                if (newPrayerText.trim()) {
                  addPrayer.mutate(newPrayerText);
                }
              }}
              disabled={!newPrayerText.trim()}
              className="bg-orange-600 hover:bg-orange-700 text-white shrink-0"
              size="icon"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
