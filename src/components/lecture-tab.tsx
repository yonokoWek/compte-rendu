'use client';

import React, { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, eachDayOfInterval, getDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAppStore, DAY_NAMES_SHORT } from '@/store/app-store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Plus, Trash2, Check, BookOpen, Book, Upload, StickyNote,
  ChevronDown, ChevronRight, FileText, GripVertical, X,
} from 'lucide-react';
import { toast } from 'sonner';

// Bible book structure
const BIBLE_BOOKS = [
  { name: 'Genèse', chapters: 50, testament: 'AT' },
  { name: 'Exode', chapters: 40, testament: 'AT' },
  { name: 'Lévitique', chapters: 27, testament: 'AT' },
  { name: 'Nombres', chapters: 36, testament: 'AT' },
  { name: 'Deutéronome', chapters: 34, testament: 'AT' },
  { name: 'Josué', chapters: 24, testament: 'AT' },
  { name: 'Juges', chapters: 21, testament: 'AT' },
  { name: 'Ruth', chapters: 4, testament: 'AT' },
  { name: '1 Samuel', chapters: 31, testament: 'AT' },
  { name: '2 Samuel', chapters: 24, testament: 'AT' },
  { name: '1 Rois', chapters: 22, testament: 'AT' },
  { name: '2 Rois', chapters: 25, testament: 'AT' },
  { name: '1 Chroniques', chapters: 29, testament: 'AT' },
  { name: '2 Chroniques', chapters: 36, testament: 'AT' },
  { name: 'Esdras', chapters: 10, testament: 'AT' },
  { name: 'Néhémie', chapters: 13, testament: 'AT' },
  { name: 'Esther', chapters: 10, testament: 'AT' },
  { name: 'Job', chapters: 42, testament: 'AT' },
  { name: 'Psaumes', chapters: 150, testament: 'AT' },
  { name: 'Proverbes', chapters: 31, testament: 'AT' },
  { name: 'Ecclésiaste', chapters: 12, testament: 'AT' },
  { name: 'Cantique', chapters: 8, testament: 'AT' },
  { name: 'Esaïe', chapters: 66, testament: 'AT' },
  { name: 'Jérémie', chapters: 52, testament: 'AT' },
  { name: 'Lamentations', chapters: 5, testament: 'AT' },
  { name: 'Ezéchiel', chapters: 48, testament: 'AT' },
  { name: 'Daniel', chapters: 12, testament: 'AT' },
  { name: 'Osée', chapters: 14, testament: 'AT' },
  { name: 'Joël', chapters: 3, testament: 'AT' },
  { name: 'Amos', chapters: 9, testament: 'AT' },
  { name: 'Abdias', chapters: 1, testament: 'AT' },
  { name: 'Jonas', chapters: 4, testament: 'AT' },
  { name: 'Michée', chapters: 7, testament: 'AT' },
  { name: 'Nahum', chapters: 3, testament: 'AT' },
  { name: 'Habakuk', chapters: 3, testament: 'AT' },
  { name: 'Sophonie', chapters: 3, testament: 'AT' },
  { name: 'Aggée', chapters: 2, testament: 'AT' },
  { name: 'Zacharie', chapters: 14, testament: 'AT' },
  { name: 'Malachie', chapters: 4, testament: 'AT' },
  { name: 'Matthieu', chapters: 28, testament: 'NT' },
  { name: 'Marc', chapters: 16, testament: 'NT' },
  { name: 'Luc', chapters: 24, testament: 'NT' },
  { name: 'Jean', chapters: 21, testament: 'NT' },
  { name: 'Actes', chapters: 28, testament: 'NT' },
  { name: 'Romains', chapters: 16, testament: 'NT' },
  { name: '1 Corinthiens', chapters: 16, testament: 'NT' },
  { name: '2 Corinthiens', chapters: 13, testament: 'NT' },
  { name: 'Galates', chapters: 6, testament: 'NT' },
  { name: 'Ephésiens', chapters: 6, testament: 'NT' },
  { name: 'Philippiens', chapters: 4, testament: 'NT' },
  { name: 'Colossiens', chapters: 4, testament: 'NT' },
  { name: '1 Thessaloniciens', chapters: 5, testament: 'NT' },
  { name: '2 Thessaloniciens', chapters: 3, testament: 'NT' },
  { name: '1 Timothée', chapters: 6, testament: 'NT' },
  { name: '2 Timothée', chapters: 4, testament: 'NT' },
  { name: 'Tite', chapters: 3, testament: 'NT' },
  { name: 'Philémon', chapters: 1, testament: 'NT' },
  { name: 'Hébreux', chapters: 13, testament: 'NT' },
  { name: 'Jacques', chapters: 5, testament: 'NT' },
  { name: '1 Pierre', chapters: 5, testament: 'NT' },
  { name: '2 Pierre', chapters: 3, testament: 'NT' },
  { name: '1 Jean', chapters: 5, testament: 'NT' },
  { name: '2 Jean', chapters: 1, testament: 'NT' },
  { name: '3 Jean', chapters: 1, testament: 'NT' },
  { name: 'Jude', chapters: 1, testament: 'NT' },
  { name: 'Apocalypse', chapters: 22, testament: 'NT' },
];

interface Book {
  id: string;
  title: string;
  author: string;
  totalChapters: number;
  currentChapter: number;
  status: string;
  pdfUrl: string;
  notes: { id: string; content: string; positionX: number; positionY: number }[];
}

interface BibleLog { id: string; date: string; chapters: number; }
interface PrayerNeed { id: string; text: string; resolved: boolean; }
interface ReadingNote { id: string; bookId: string | null; bibleRef: string; content: string; positionX: number; positionY: number; }

// Floating Note Component
function FloatingNote({ note, onUpdate, onDelete, onDragStart }: {
  note: ReadingNote;
  onUpdate: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  onDragStart: (id: string, e: React.MouseEvent) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.content);

  const handleSave = () => {
    onUpdate(note.id, text);
    setEditing(false);
  };

  return (
    <div
      className="absolute z-50 cursor-move select-none"
      style={{ left: `${note.positionX}%`, top: `${note.positionY}%` }}
      onMouseDown={(e) => onDragStart(note.id, e)}
    >
      <div className="bg-yellow-100 border border-yellow-300 rounded-lg shadow-lg p-2 min-w-[140px] max-w-[200px]">
        <div className="flex items-center justify-between mb-1">
          <GripVertical className="h-3 w-3 text-yellow-400" />
          <button onClick={() => onDelete(note.id)} className="text-yellow-400 hover:text-red-400">
            <X className="h-3 w-3" />
          </button>
        </div>
        {editing ? (
          <textarea value={text} onChange={(e) => setText(e.target.value)} onBlur={handleSave}
            onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false); }}
            className="w-full text-[10px] bg-transparent border-none outline-none resize-none h-12"
            autoFocus />
        ) : (
          <p onClick={() => setEditing(true)} className="text-[10px] text-gray-700 cursor-text leading-tight">{note.content}</p>
        )}
        {note.bibleRef && <p className="text-[8px] text-yellow-600 mt-1 font-medium">📖 {note.bibleRef}</p>}
      </div>
    </div>
  );
}

export default function LectureTab() {
  const period = useAppStore((s) => s.period);
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<string | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const [newBookTitle, setNewBookTitle] = useState('');
  const [newBookAuthor, setNewBookAuthor] = useState('');
  const [newBookChapters, setNewBookChapters] = useState('');
  const [newPrayerText, setNewPrayerText] = useState('');
  const [chapterInput, setChapterInput] = useState<Record<string, string>>({});
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteContext, setNoteContext] = useState<{ bookId?: string; bibleRef?: string }>({});
  const [expandedTestament, setExpandedTestament] = useState<string | null>('NT');
  const [bibleBookFilter, setBibleBookFilter] = useState('');
  const [uploadingBookId, setUploadingBookId] = useState<string | null>(null);

  const { data: books = [] } = useQuery<Book[]>({ queryKey: ['books'], queryFn: () => fetch('/api/books').then((r) => r.json()) });
  const { data: bibleLogs = [] } = useQuery<BibleLog[]>({ queryKey: ['bible', period.startDate, period.endDate], queryFn: () => fetch(`/api/bible?startDate=${format(period.startDate, 'yyyy-MM-dd')}&endDate=${format(period.endDate, 'yyyy-MM-dd')}`).then((r) => r.json()) });
  const { data: prayers = [] } = useQuery<PrayerNeed[]>({ queryKey: ['prayers'], queryFn: () => fetch('/api/prayers').then((r) => r.json()) });
  const { data: notes = [] } = useQuery<ReadingNote[]>({ queryKey: ['notes'], queryFn: () => fetch('/api/notes').then((r) => r.json()) });

  const addBook = useMutation({ mutationFn: (data: { title: string; author: string; totalChapters: number; pdfUrl: string }) => fetch('/api/books', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then((r) => r.json()), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['books'] }); setNewBookTitle(''); setNewBookAuthor(''); setNewBookChapters(''); } });
  const deleteBook = useMutation({ mutationFn: (id: string) => fetch(`/api/books?id=${id}`, { method: 'DELETE' }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['books'] }) });
  const saveBibleLog = useMutation({ mutationFn: (data: { date: string; chapters: number }) => fetch('/api/bible', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then((r) => r.json()), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bible'] }) });
  const addPrayer = useMutation({ mutationFn: (text: string) => fetch('/api/prayers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) }).then((r) => r.json()), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['prayers'] }); setNewPrayerText(''); } });
  const togglePrayer = useMutation({ mutationFn: (data: { id: string; resolved: boolean }) => fetch('/api/prayers', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then((r) => r.json()), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['prayers'] }) });
  const deletePrayer = useMutation({ mutationFn: (id: string) => fetch(`/api/prayers?id=${id}`, { method: 'DELETE' }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['prayers'] }) });

  const addNote = useMutation({ mutationFn: (data: { bookId?: string; bibleRef?: string; content: string; positionX: number; positionY: number }) => fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then((r) => r.json()), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['notes'] }); setNoteDialogOpen(false); setNoteText(''); toast.success('Note ajoutée'); } });
  const updateNote = useMutation({ mutationFn: (data: { id: string; content: string; positionX: number; positionY: number }) => fetch('/api/notes', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then((r) => r.json()), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notes'] }) });
  const deleteNote = useMutation({ mutationFn: (id: string) => fetch(`/api/notes?id=${id}`, { method: 'DELETE' }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notes'] }) });

  const uploadPdf = async (bookId: string, file: File) => {
    setUploadingBookId(bookId);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) {
        await fetch('/api/books', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: bookId, pdfUrl: data.url }) });
        queryClient.invalidateQueries({ queryKey: ['books'] });
        toast.success('PDF ajouté');
      }
    } catch { toast.error('Erreur upload'); }
    setUploadingBookId(null);
  };

  const handleNoteDrag = useCallback((noteId: string, e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = noteId;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    dragOffsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const handleNoteDragMove = useCallback((e: React.MouseEvent) => {
    if (!draggingRef.current || !containerRef.current) return;
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    updateNote.mutate({ id: draggingRef.current, content: '', positionX: x, positionY: y });
  }, [updateNote]);

  const handleNoteDragEnd = useCallback(() => { draggingRef.current = null; }, []);

  const bibleLogMap: Record<string, number> = {};
  for (const log of bibleLogs) bibleLogMap[log.date] = log.chapters;
  const totalBibleChapters = Object.values(bibleLogMap).reduce((s, v) => s + v, 0);
  const activeBooks = books.filter((b) => b.status === 'in_progress');
  const finishedBooks = books.filter((b) => b.status === 'finished');

  const filteredBibleBooks = BIBLE_BOOKS.filter((b) => b.name.toLowerCase().includes(bibleBookFilter.toLowerCase()));
  const atBooks = filteredBibleBooks.filter((b) => b.testament === 'AT');
  const ntBooks = filteredBibleBooks.filter((b) => b.testament === 'NT');

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4" ref={containerRef} onMouseMove={handleNoteDragMove} onMouseUp={handleNoteDragEnd} onMouseLeave={handleNoteDragEnd}>
      {/* Floating notes */}
      {notes.map((note) => (
        <FloatingNote key={note.id} note={note} onUpdate={(id, content) => updateNote.mutate({ id, content, positionX: 0, positionY: 0 })} onDelete={(id) => deleteNote.mutate(id)} onDragStart={handleNoteDrag} />
      ))}

      <Tabs defaultValue="livres" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="livres" className="text-xs gap-1"><Book className="h-3 w-3" /> Livres</TabsTrigger>
          <TabsTrigger value="bible" className="text-xs gap-1"><BookOpen className="h-3 w-3" /> Bible</TabsTrigger>
          <TabsTrigger value="prieres" className="text-xs gap-1"><span className="text-xs">❤️</span> Prières</TabsTrigger>
        </TabsList>

        {/* Livres Tab */}
        <TabsContent value="livres" className="space-y-4 mt-4">
          <div className="flex gap-3">
            <Card className="flex-1 border-orange-200 bg-orange-50"><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-orange-600">{books.length}</p><p className="text-xs text-gray-600">Total livres</p></CardContent></Card>
            <Card className="flex-1 border-orange-200 bg-orange-50"><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-orange-600">{books.reduce((s, b) => s + b.currentChapter, 0)}</p><p className="text-xs text-gray-600">Chapitres lus</p></CardContent></Card>
          </div>

          <Card><CardContent className="p-3 space-y-2">
            <Input placeholder="Titre du livre" value={newBookTitle} onChange={(e) => setNewBookTitle(e.target.value)} className="text-sm" />
            <div className="flex gap-2">
              <Input placeholder="Auteur" value={newBookAuthor} onChange={(e) => setNewBookAuthor(e.target.value)} className="text-sm flex-1" />
              <Input placeholder="Nb chapitres" type="number" value={newBookChapters} onChange={(e) => setNewBookChapters(e.target.value)} className="text-sm w-24" />
            </div>
            <div className="flex gap-2">
              <label className="flex items-center gap-2 text-xs text-gray-600 flex-1 cursor-pointer bg-gray-50 rounded-lg px-3 py-2 border border-dashed border-gray-300 hover:border-orange-300 hover:bg-orange-50 transition-colors">
                <Upload className="h-4 w-4 text-orange-500" />
                <span className="truncate">{newBookTitle ? `PDF pour "${newBookTitle}"` : 'Ajouter un PDF (optionnel)'}</span>
                <input type="file" accept=".pdf" className="hidden" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    // Will upload after book creation
                    const input = e.target;
                    (window as unknown as Record<string, File>).__pendingPdf = file;
                    toast.info(`PDF "${file.name}" sera attaché après création du livre`);
                  }
                }} />
              </label>
            </div>
            <Button onClick={async () => {
              if (!newBookTitle.trim()) return;
              const pendingPdf = (window as unknown as Record<string, File>).__pendingPdf;
              (window as unknown as Record<string, File>).__pendingPdf = undefined;
              const res = await addBook.mutateAsync({ title: newBookTitle, author: newBookAuthor, totalChapters: parseInt(newBookChapters) || 0, pdfUrl: '' });
              if (pendingPdf && res?.id) uploadPdf(res.id, pendingPdf);
            }} disabled={!newBookTitle.trim() || addBook.isPending} className="w-full bg-orange-600 hover:bg-orange-700 text-white text-xs">
              <Plus className="h-3 w-3 mr-1" /> Ajouter un livre
            </Button>
          </CardContent></Card>

          {/* Active books */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">📚 Livres en cours</h3>
            {activeBooks.length === 0 && <p className="text-xs text-gray-400 italic">Aucun livre en cours</p>}
            {activeBooks.map((book) => (
              <Card key={book.id} className="border-l-4 border-l-orange-400">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{book.title}</p>
                      <p className="text-xs text-gray-500">{book.author ? `${book.author} • ` : ''}{book.currentChapter}/{book.totalChapters || '?'} chap.</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {book.pdfUrl && (
                        <a href={book.pdfUrl} target="_blank" rel="noopener noreferrer" className="p-1 text-orange-500 hover:text-orange-700"><FileText className="h-4 w-4" /></a>
                      )}
                      <button onClick={() => { setNoteContext({ bookId: book.id }); setNoteDialogOpen(true); }} className="p-1 text-yellow-500 hover:text-yellow-600"><StickyNote className="h-4 w-4" /></button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-red-500" onClick={() => deleteBook.mutate(book.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                  {/* Attach PDF */}
                  {!book.pdfUrl && (
                    <label className="flex items-center gap-2 mt-2 text-[10px] text-gray-500 cursor-pointer hover:text-orange-500">
                      <Upload className="h-3 w-3" /> Attacher un PDF
                      <input type="file" accept=".pdf" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadPdf(book.id, file); }} />
                    </label>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

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
                    <div className="flex items-center gap-1">
                      {book.pdfUrl && <a href={book.pdfUrl} target="_blank" rel="noopener noreferrer" className="p-1 text-orange-500"><FileText className="h-4 w-4" /></a>}
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-red-500" onClick={() => deleteBook.mutate(book.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Bible Tab */}
        <TabsContent value="bible" className="space-y-4 mt-4">
          <Card className="border-orange-200 bg-orange-50"><CardContent className="p-4 text-center"><p className="text-xs text-gray-600">Total chapitres cette semaine</p><p className="text-3xl font-bold text-orange-600">{totalBibleChapters}</p></CardContent></Card>

          {/* Daily bible reading */}
          <Card><CardContent className="p-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Chapitres lus par jour</h3>
              <button onClick={() => { setNoteContext({ bibleRef: format(period.startDate, 'dd/MM') }); setNoteDialogOpen(true); }} className="p-1 text-yellow-500 hover:text-yellow-600"><StickyNote className="h-4 w-4" /></button>
            </div>
            <div className="space-y-2">
              {[0, 1, 2, 3, 4, 5, 6].map((offset) => {
                const date = new Date(period.startDate);
                date.setDate(date.getDate() + offset);
                if (date > period.endDate) return null;
                const dateStr = format(date, 'yyyy-MM-dd');
                const dayName = format(date, 'EEEE', { locale: fr });
                const dayIndex = getDay(date);
                return (
                  <div key={dateStr} className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-20 capitalize">{DAY_NAMES_SHORT[dayIndex === 0 ? 6 : dayIndex - 1]}</span>
                    <Input type="number" min="0" placeholder="0" value={chapterInput[dateStr] ?? bibleLogMap[dateStr] ?? ''} onChange={(e) => { const val = parseInt(e.target.value) || 0; setChapterInput((p) => ({ ...p, [dateStr]: e.target.value })); saveBibleLog.mutate({ date: dateStr, chapters: val }); }} className="flex-1 h-8 text-sm text-center" />
                    <span className="text-[10px] text-gray-400">ch.</span>
                  </div>
                );
              })}
            </div>
          </CardContent></Card>

          {/* Bible book browser */}
          <Card><CardContent className="p-3">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">📖 Livres de la Bible</h3>
            <Input placeholder="Rechercher un livre..." value={bibleBookFilter} onChange={(e) => setBibleBookFilter(e.target.value)} className="text-xs h-8 mb-3" />

            {/* NT */}
            <div className="mb-3">
              <button onClick={() => setExpandedTestament(expandedTestament === 'NT' ? null : 'NT')} className="flex items-center gap-2 text-xs font-semibold text-orange-600 w-full">
                {expandedTestament === 'NT' ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                Nouveau Testament ({ntBooks.length} livres)
              </button>
              {expandedTestament === 'NT' && (
                <div className="mt-1 ml-2 grid grid-cols-2 gap-1 max-h-48 overflow-y-auto">
                  {ntBooks.map((b) => (
                    <button key={b.name} onClick={() => { setNoteContext({ bibleRef: b.name }); setNoteDialogOpen(true); }} className="text-left text-[10px] px-2 py-1 rounded hover:bg-orange-50 text-gray-700 truncate">
                      {b.name} <span className="text-gray-400">({b.chapters})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* AT */}
            <div>
              <button onClick={() => setExpandedTestament(expandedTestament === 'AT' ? null : 'AT')} className="flex items-center gap-2 text-xs font-semibold text-orange-600 w-full">
                {expandedTestament === 'AT' ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                Ancien Testament ({atBooks.length} livres)
              </button>
              {expandedTestament === 'AT' && (
                <div className="mt-1 ml-2 grid grid-cols-2 gap-1 max-h-48 overflow-y-auto">
                  {atBooks.map((b) => (
                    <button key={b.name} onClick={() => { setNoteContext({ bibleRef: b.name }); setNoteDialogOpen(true); }} className="text-left text-[10px] px-2 py-1 rounded hover:bg-orange-50 text-gray-700 truncate">
                      {b.name} <span className="text-gray-400">({b.chapters})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </CardContent></Card>
        </TabsContent>

        {/* Prières Tab */}
        <TabsContent value="prieres" className="space-y-4 mt-4">
          <Card><CardContent className="p-3">
            {prayers.length === 0 && <div className="text-center py-6 text-gray-400"><p className="text-sm">Aucun besoin de prière</p></div>}
            <div className="space-y-2">
              {prayers.map((prayer) => (
                <div key={prayer.id} className={`flex items-start gap-2 p-2 rounded-lg border ${prayer.resolved ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'}`}>
                  <button onClick={() => togglePrayer.mutate({ id: prayer.id, resolved: !prayer.resolved })} className={`mt-0.5 shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center ${prayer.resolved ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'}`}>
                    {prayer.resolved && <Check className="h-3 w-3" />}
                  </button>
                  <p className={`text-sm flex-1 ${prayer.resolved ? 'line-through text-gray-400' : 'text-gray-700'}`}>{prayer.text}</p>
                  <Button variant="ghost" size="icon" className="shrink-0 h-6 w-6 text-gray-400 hover:text-red-500" onClick={() => deletePrayer.mutate(prayer.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              ))}
            </div>
          </CardContent></Card>
          <div className="flex gap-2">
            <Input placeholder="Ajouter un besoin de prière..." value={newPrayerText} onChange={(e) => setNewPrayerText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newPrayerText.trim()) addPrayer.mutate(newPrayerText); }} className="text-sm" />
            <Button onClick={() => { if (newPrayerText.trim()) addPrayer.mutate(newPrayerText); }} disabled={!newPrayerText.trim()} className="bg-orange-600 hover:bg-orange-700 text-white shrink-0" size="icon"><Plus className="h-4 w-4" /></Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Note Dialog */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><StickyNote className="h-5 w-5 text-yellow-500" /> Ajouter une note</DialogTitle>
            <DialogDescription>{noteContext.bibleRef ? `Note pour : ${noteContext.bibleRef}` : 'Votre note personnelle'}</DialogDescription>
          </DialogHeader>
          <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Écrivez votre note ici..." className="min-h-[100px] text-sm" autoFocus />
          <Button onClick={() => {
            if (!noteText.trim()) return;
            addNote.mutate({ ...noteContext, content: noteText, positionX: 50, positionY: 50 });
          }} disabled={!noteText.trim()} className="w-full bg-orange-600 hover:bg-orange-700 text-white text-xs">
            <Plus className="h-3 w-3 mr-1" /> Ajouter la note
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
