'use client';

import React, { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, getDay } from 'date-fns';
import { useAppStore, DAY_NAMES_SHORT } from '@/store/app-store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Plus, Trash2, Check, BookOpen, Book, Upload, StickyNote,
  ChevronDown, ChevronRight, FileText, GripVertical, X,
  Minus, Eye, PenLine,
} from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '@/lib/api';
import PdfViewerDialog from '@/components/pdf-viewer-dialog';

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

interface BookItem {
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
interface ReadingNote {
  id: string;
  bookId: string | null;
  bibleRef: string;
  content: string;
  positionX: number;
  positionY: number;
}

// Floating Note Component with proper drag handling
function FloatingNote({ note, onUpdate, onDelete }: {
  note: ReadingNote;
  onUpdate: (id: string, content: string, positionX: number, positionY: number) => void;
  onDelete: (id: string) => void;
}) {
  const noteRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const isDragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const startMousePos = useRef({ x: 0, y: 0 });
  const [editText, setEditText] = useState(note.content);

  const startEditing = useCallback(() => {
    setEditText(note.content);
    setEditing(true);
  }, [note.content]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (editing) return; // Don't drag while editing
    e.preventDefault();
    isDragging.current = false;
    startPos.current = { x: note.positionX, y: note.positionY };
    startMousePos.current = { x: e.clientX, y: e.clientY };

    const handleMove = (me: MouseEvent) => {
      const dx = me.clientX - startMousePos.current.x;
      const dy = me.clientY - startMousePos.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        isDragging.current = true;
      }
      if (!isDragging.current || !noteRef.current) return;
      const parent = noteRef.current.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const newX = Math.max(0, Math.min(95, ((startPos.current.x / 100) * rect.width + dx) / rect.width * 100));
      const newY = Math.max(0, Math.min(90, ((startPos.current.y / 100) * rect.height + dy) / rect.height * 100));
      noteRef.current.style.left = `${newX}%`;
      noteRef.current.style.top = `${newY}%`;
    };

    const handleUp = (me: MouseEvent) => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      if (isDragging.current && noteRef.current) {
        const left = parseFloat(noteRef.current.style.left) || note.positionX;
        const top = parseFloat(noteRef.current.style.top) || note.positionY;
        onUpdate(note.id, note.content, left, top);
      }
      isDragging.current = false;
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [note.id, note.content, note.positionX, note.positionY, editing, onUpdate]);

  // Touch support for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (editing) return;
    const touch = e.touches[0];
    isDragging.current = false;
    startPos.current = { x: note.positionX, y: note.positionY };
    startMousePos.current = { x: touch.clientX, y: touch.clientY };

    const handleTouchMove = (te: TouchEvent) => {
      const t = te.touches[0];
      const dx = t.clientX - startMousePos.current.x;
      const dy = t.clientY - startMousePos.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        isDragging.current = true;
      }
      if (!isDragging.current || !noteRef.current) return;
      const parent = noteRef.current.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const newX = Math.max(0, Math.min(95, ((startPos.current.x / 100) * rect.width + dx) / rect.width * 100));
      const newY = Math.max(0, Math.min(90, ((startPos.current.y / 100) * rect.height + dy) / rect.height * 100));
      noteRef.current.style.left = `${newX}%`;
      noteRef.current.style.top = `${newY}%`;
    };

    const handleTouchEnd = () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      if (isDragging.current && noteRef.current) {
        const left = parseFloat(noteRef.current.style.left) || note.positionX;
        const top = parseFloat(noteRef.current.style.top) || note.positionY;
        onUpdate(note.id, note.content, left, top);
      }
      isDragging.current = false;
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);
  }, [note.id, note.content, note.positionX, note.positionY, editing, onUpdate]);

  const handleSave = () => {
    onUpdate(note.id, editText, note.positionX, note.positionY);
    setEditing(false);
  };

  return (
    <div
      ref={noteRef}
      className="absolute z-50 select-none"
      style={{ left: `${note.positionX}%`, top: `${note.positionY}%` }}
    >
      <div className="bg-yellow-100 border-2 border-yellow-300 rounded-lg shadow-lg p-2 min-w-[130px] max-w-[180px] transition-shadow hover:shadow-xl">
        <div className="flex items-center justify-between mb-1">
          <GripVertical className="h-3 w-3 text-yellow-400 cursor-grab active:cursor-grabbing" />
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); if (editing) { handleSave(); } else { startEditing(); } }}
              className="text-yellow-400 hover:text-[var(--theme-primary)]"
            >
              <PenLine className="h-2.5 w-2.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(note.id); }}
              className="text-yellow-400 hover:text-red-500"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        </div>
        {note.bibleRef && (
          <p className="text-[8px] text-[var(--theme-primary)] font-bold mb-0.5">📖 {note.bibleRef}</p>
        )}
        {editing ? (
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false); if (e.key === 'Enter' && e.metaKey) handleSave(); }}
            className="w-full text-[10px] bg-transparent border border-yellow-200 rounded p-1 outline-none resize-none h-16 focus:border-[var(--theme-primary)]"
            autoFocus
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          />
        ) : (
          <p
            onClick={(e) => { e.stopPropagation(); startEditing(); }}
            className="text-[10px] text-gray-700 cursor-text leading-tight"
          >
            {note.content}
          </p>
        )}
      </div>
    </div>
  );
}

export default function LectureTab() {
  const period = useAppStore((s) => s.period);
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);

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
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [pdfViewerUrl, setPdfViewerUrl] = useState('');
  const [pdfViewerTitle, setPdfViewerTitle] = useState('');
  const [bibleBookSelect, setBibleBookSelect] = useState('');
  const [bibleChapterFrom, setBibleChapterFrom] = useState('');
  const [bibleChapterTo, setBibleChapterTo] = useState('');

  const { data: books = [] } = useQuery<BookItem[]>({ queryKey: ['books'], queryFn: () => authFetch('/api/books').then((r) => r.json()) });
  const { data: bibleLogs = [] } = useQuery<BibleLog[]>({ queryKey: ['bible', period.startDate, period.endDate], queryFn: () => authFetch(`/api/bible?startDate=${format(period.startDate, 'yyyy-MM-dd')}&endDate=${format(period.endDate, 'yyyy-MM-dd')}`).then((r) => r.json()) });
  const { data: prayers = [] } = useQuery<PrayerNeed[]>({ queryKey: ['prayers'], queryFn: () => authFetch('/api/prayers').then((r) => r.json()) });
  const { data: notes = [] } = useQuery<ReadingNote[]>({ queryKey: ['notes'], queryFn: () => authFetch('/api/notes').then((r) => r.json()) });

  const addBook = useMutation({
    mutationFn: (data: { title: string; author: string; totalChapters: number; pdfUrl: string }) =>
      authFetch('/api/books', { method: 'POST', body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['books'] }); setNewBookTitle(''); setNewBookAuthor(''); setNewBookChapters(''); },
  });
  const updateBook = useMutation({
    mutationFn: (data: { id: string; currentChapter: number; status: string }) =>
      authFetch('/api/books', { method: 'PUT', body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['books'] }),
  });
  const deleteBook = useMutation({
    mutationFn: (id: string) => authFetch(`/api/books?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['books'] }),
  });
  const saveBibleLog = useMutation({
    mutationFn: (data: { date: string; chapters: number; reference?: string }) =>
      authFetch('/api/bible', { method: 'POST', body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bible'] }),
  });
  const addPrayer = useMutation({
    mutationFn: (text: string) => authFetch('/api/prayers', { method: 'POST', body: JSON.stringify({ text }) }).then((r) => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['prayers'] }); setNewPrayerText(''); },
  });
  const togglePrayer = useMutation({
    mutationFn: (data: { id: string; resolved: boolean }) => authFetch('/api/prayers', { method: 'PUT', body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['prayers'] }),
  });
  const deletePrayer = useMutation({
    mutationFn: (id: string) => authFetch(`/api/prayers?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['prayers'] }),
  });

  const addNote = useMutation({
    mutationFn: (data: { bookId?: string; bibleRef?: string; content: string; positionX: number; positionY: number }) =>
      authFetch('/api/notes', { method: 'POST', body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['notes'] }); setNoteDialogOpen(false); setNoteText(''); toast.success('Note ajoutée'); },
  });
  const updateNote = useMutation({
    mutationFn: (data: { id: string; content: string; positionX: number; positionY: number }) =>
      authFetch('/api/notes', { method: 'PUT', body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notes'] }),
  });
  const deleteNote = useMutation({
    mutationFn: (id: string) => authFetch(`/api/notes?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notes'] }),
  });

  const uploadPdf = async (bookId: string, file: File) => {
    setUploadingBookId(bookId);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await authFetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) {
        await authFetch('/api/books', { method: 'PUT', body: JSON.stringify({ id: bookId, pdfUrl: data.url }) });
        queryClient.invalidateQueries({ queryKey: ['books'] });
        toast.success('PDF ajouté au livre');
      }
    } catch { toast.error('Erreur upload'); }
    setUploadingBookId(null);
  };

  const bibleLogMap: Record<string, number> = {};
  for (const log of bibleLogs) bibleLogMap[log.date] = log.chapters;
  const totalBibleChapters = Object.values(bibleLogMap).reduce((s, v) => s + v, 0);
  const activeBooks = books.filter((b) => b.status === 'in_progress');
  const finishedBooks = books.filter((b) => b.status === 'finished');

  const filteredBibleBooks = BIBLE_BOOKS.filter((b) => b.name.toLowerCase().includes(bibleBookFilter.toLowerCase()));
  const atBooks = filteredBibleBooks.filter((b) => b.testament === 'AT');
  const ntBooks = filteredBibleBooks.filter((b) => b.testament === 'NT');

  const openPdfViewer = (url: string, title: string) => {
    setPdfViewerUrl(url);
    setPdfViewerTitle(title);
    setPdfViewerOpen(true);
  };

  const handleNoteUpdate = useCallback((id: string, content: string, positionX: number, positionY: number) => {
    updateNote.mutate({ id, content, positionX, positionY });
  }, [updateNote]);

  const handleNoteDelete = useCallback((id: string) => {
    deleteNote.mutate(id);
    toast.success('Note supprimée');
  }, [deleteNote]);

  // Compute selected bible book info
  const selectedBibleBook = BIBLE_BOOKS.find((b) => b.name === bibleBookSelect);

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4 relative" ref={containerRef}>
      {/* Floating notes overlay */}
      {notes.map((note) => (
        <FloatingNote
          key={note.id}
          note={note}
          onUpdate={handleNoteUpdate}
          onDelete={handleNoteDelete}
        />
      ))}

      {/* Floating add note button */}
      <button
        onClick={() => { setNoteContext({}); setNoteDialogOpen(true); }}
        className="fixed bottom-24 right-4 z-40 bg-yellow-400 hover:bg-yellow-500 text-gray-800 rounded-full w-12 h-12 flex items-center justify-center shadow-lg transition-transform hover:scale-110 active:scale-95"
        title="Ajouter une note"
      >
        <StickyNote className="h-5 w-5" />
      </button>

      <Tabs defaultValue="livres" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="livres" className="text-xs gap-1"><Book className="h-3 w-3" /> Livres</TabsTrigger>
          <TabsTrigger value="bible" className="text-xs gap-1"><BookOpen className="h-3 w-3" /> Bible</TabsTrigger>
          <TabsTrigger value="prieres" className="text-xs gap-1"><span className="text-xs">🙏</span> Prières</TabsTrigger>
        </TabsList>

        {/* ============ LIVRES TAB ============ */}
        <TabsContent value="livres" className="space-y-4 mt-4">
          <div className="flex gap-3">
            <Card className="flex-1 border-[var(--theme-primary)] bg-[var(--theme-primary-light)]"><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-[var(--theme-primary)]">{books.length}</p><p className="text-xs text-gray-600">Total livres</p></CardContent></Card>
            <Card className="flex-1 border-[var(--theme-primary)] bg-[var(--theme-primary-light)]"><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-[var(--theme-primary)]">{books.reduce((s, b) => s + b.currentChapter, 0)}</p><p className="text-xs text-gray-600">Chapitres lus</p></CardContent></Card>
          </div>

          {/* Add book form */}
          <Card className="border-[var(--theme-primary)]">
            <CardContent className="p-3 space-y-2">
              <h4 className="text-xs font-semibold text-gray-700">Ajouter un livre</h4>
              <Input placeholder="Titre du livre" value={newBookTitle} onChange={(e) => setNewBookTitle(e.target.value)} className="text-sm" />
              <div className="flex gap-2">
                <Input placeholder="Auteur" value={newBookAuthor} onChange={(e) => setNewBookAuthor(e.target.value)} className="text-sm flex-1" />
                <Input placeholder="Nb chapitres" type="number" value={newBookChapters} onChange={(e) => setNewBookChapters(e.target.value)} className="text-sm w-24" />
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer bg-gray-50 rounded-lg px-3 py-2.5 border border-dashed border-gray-300 hover:border-[var(--theme-primary)] hover:bg-[var(--theme-primary-light)] transition-colors">
                <Upload className="h-4 w-4 text-[var(--theme-primary)]" />
                <span className="truncate text-xs">{newBookTitle ? `PDF pour « ${newBookTitle} »` : 'Joindre un PDF (optionnel)'}</span>
                <input type="file" accept=".pdf" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    (window as unknown as Record<string, File>).__pendingPdf = file;
                    toast.info(`PDF « ${file.name} » sera attaché après création`);
                  }
                }} />
              </label>
              <Button onClick={async () => {
                if (!newBookTitle.trim()) return;
                const pendingPdf = (window as unknown as Record<string, File>).__pendingPdf;
                (window as unknown as Record<string, File>).__pendingPdf = undefined;
                const res = await addBook.mutateAsync({ title: newBookTitle, author: newBookAuthor, totalChapters: parseInt(newBookChapters) || 0, pdfUrl: '' });
                if (pendingPdf && res?.id) uploadPdf(res.id, pendingPdf);
                toast.success('Livre ajouté');
              }} disabled={!newBookTitle.trim() || addBook.isPending} className="w-full bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-white text-xs">
                <Plus className="h-3 w-3 mr-1" /> Ajouter un livre
              </Button>
            </CardContent>
          </Card>

          {/* Active books with progress */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">📚 En cours de lecture</h3>
            {activeBooks.length === 0 && <p className="text-xs text-gray-400 italic py-2">Aucun livre en cours</p>}
            {activeBooks.map((book) => {
              const progress = book.totalChapters > 0 ? Math.round((book.currentChapter / book.totalChapters) * 100) : 0;
              return (
                <Card key={book.id} className="border-l-4 border-l-[var(--theme-primary)]">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{book.title}</p>
                        <p className="text-xs text-gray-500">{book.author ? `${book.author} • ` : ''}{book.currentChapter}/{book.totalChapters || '?'} chap.</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {book.pdfUrl && (
                          <button onClick={() => openPdfViewer(book.pdfUrl, book.title)} className="p-1.5 text-[var(--theme-primary)] hover:text-[var(--theme-primary-hover)] hover:bg-[var(--theme-primary-light)] rounded" title="Lire le PDF">
                            <Eye className="h-4 w-4" />
                          </button>
                        )}
                        <button onClick={() => { setNoteContext({ bookId: book.id }); setNoteDialogOpen(true); }} className="p-1.5 text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50 rounded" title="Ajouter une note">
                          <StickyNote className="h-4 w-4" />
                        </button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500" onClick={() => { deleteBook.mutate(book.id); toast.success('Livre supprimé'); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>

                    {/* Progress bar */}
                    {book.totalChapters > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-gray-500">
                          <span>Progression</span>
                          <span className="font-medium text-[var(--theme-primary)]">{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                    )}

                    {/* Chapter controls */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline" size="icon" className="h-7 w-7 shrink-0"
                        onClick={() => {
                          const newCh = Math.max(0, book.currentChapter - 1);
                          updateBook.mutate({ id: book.id, currentChapter: newCh, status: newCh >= book.totalChapters && book.totalChapters > 0 ? 'finished' : 'in_progress' });
                          if (newCh >= book.totalChapters && book.totalChapters > 0) toast.success('🎉 Livre terminé !');
                        }}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <div className="flex-1 text-center">
                        <span className="text-sm font-bold text-[var(--theme-primary)]">{book.currentChapter}</span>
                        <span className="text-xs text-gray-400">/{book.totalChapters || '?'} chapitres</span>
                      </div>
                      <Button
                        variant="outline" size="icon" className="h-7 w-7 shrink-0"
                        onClick={() => {
                          const newCh = book.currentChapter + 1;
                          updateBook.mutate({ id: book.id, currentChapter: newCh, status: newCh >= book.totalChapters && book.totalChapters > 0 ? 'finished' : 'in_progress' });
                          if (newCh >= book.totalChapters && book.totalChapters > 0) toast.success('🎉 Livre terminé !');
                        }}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* Attach PDF if none */}
                    {!book.pdfUrl && (
                      <label className="flex items-center gap-2 text-[10px] text-gray-500 cursor-pointer hover:text-[var(--theme-primary)]">
                        <Upload className="h-3 w-3" /> Joindre un PDF
                        <input type="file" accept=".pdf" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadPdf(book.id, file); }} />
                      </label>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Finished books */}
          {finishedBooks.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-700">✅ Livres terminés</h3>
              {finishedBooks.map((book) => (
                <Card key={book.id} className="border-l-4 border-l-green-400 opacity-80">
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{book.title}</p>
                      <p className="text-xs text-gray-500">{book.author} • {book.currentChapter}/{book.totalChapters} chap.</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {book.pdfUrl && <button onClick={() => openPdfViewer(book.pdfUrl, book.title)} className="p-1 text-[var(--theme-primary)] hover:text-[var(--theme-primary-hover)]"><Eye className="h-4 w-4" /></button>}
                      <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700">Terminé</Badge>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-red-500" onClick={() => deleteBook.mutate(book.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ============ BIBLE TAB ============ */}
        <TabsContent value="bible" className="space-y-4 mt-4">
          <Card className="border-[var(--theme-primary)] bg-[var(--theme-primary-light)]">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-gray-600">Total chapitres cette période</p>
              <p className="text-3xl font-bold text-[var(--theme-primary)]">{totalBibleChapters}</p>
            </CardContent>
          </Card>

          {/* Bible reading entry with book/chapter selector */}
          <Card className="border-[var(--theme-primary)]">
            <CardContent className="p-3 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">📝 Enregistrer ma lecture biblique</h3>
              <div className="space-y-2">
                <Select value={bibleBookSelect} onValueChange={(v) => { setBibleBookSelect(v); setBibleChapterFrom('1'); setBibleChapterTo('1'); }}>
                  <SelectTrigger className="w-full h-9 text-xs">
                    <SelectValue placeholder="Choisir un livre..." />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="max-h-48 overflow-y-auto">
                      <div className="px-2 py-1 text-[10px] font-bold text-[var(--theme-primary)]">Nouveau Testament</div>
                      {BIBLE_BOOKS.filter((b) => b.testament === 'NT').map((b) => (
                        <SelectItem key={b.name} value={b.name} className="text-xs">{b.name} ({b.chapters} chap.)</SelectItem>
                      ))}
                      <div className="px-2 py-1 text-[10px] font-bold text-[var(--theme-primary)] mt-1">Ancien Testament</div>
                      {BIBLE_BOOKS.filter((b) => b.testament === 'AT').map((b) => (
                        <SelectItem key={b.name} value={b.name} className="text-xs">{b.name} ({b.chapters} chap.)</SelectItem>
                      ))}
                    </div>
                  </SelectContent>
                </Select>

                {bibleBookSelect && selectedBibleBook && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] text-gray-500">De</label>
                      <Select value={bibleChapterFrom} onValueChange={setBibleChapterFrom}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: selectedBibleBook.chapters }, (_, i) => (
                            <SelectItem key={i + 1} value={String(i + 1)} className="text-xs">Chapitre {i + 1}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-gray-500">À</label>
                      <Select value={bibleChapterTo} onValueChange={setBibleChapterTo}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: selectedBibleBook.chapters }, (_, i) => {
                            const ch = i + 1;
                            if (ch < parseInt(bibleChapterFrom || '1')) return null;
                            return <SelectItem key={ch} value={String(ch)} className="text-xs">Chapitre {ch}</SelectItem>;
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <Button
                  onClick={() => {
                    if (!bibleBookSelect) { toast.error('Choisissez un livre'); return; }
                    const from = parseInt(bibleChapterFrom || '1');
                    const to = parseInt(bibleChapterTo || '1');
                    const count = to - from + 1;
                    const today = format(new Date(), 'yyyy-MM-dd');
                    const currentCount = bibleLogMap[today] || 0;
                    const ref = `${bibleBookSelect} ${from}${to > from ? `-${to}` : ''}`;
                    saveBibleLog.mutate({
                      date: today,
                      chapters: currentCount + count,
                      reference: ref,
                    });
                    setBibleBookSelect('');
                    setBibleChapterFrom('');
                    setBibleChapterTo('');
                    toast.success(`✅ ${count} chapitre(s) enregistré(s) - ${ref}`);
                  }}
                  disabled={!bibleBookSelect}
                  className="w-full bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-white text-xs"
                >
                  <BookOpen className="h-3 w-3 mr-1" />
                  {bibleBookSelect ? `Enregistrer ${Math.abs(parseInt(bibleChapterTo || bibleChapterFrom) - parseInt(bibleChapterFrom || '1')) + 1} chapitre(s)` : 'Choisir un livre d\'abord'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Daily bible reading summary */}
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">📅 Chapitres lus par jour</h3>
                <button onClick={() => { setNoteContext({ bibleRef: 'Bible' }); setNoteDialogOpen(true); }} className="p-1.5 text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50 rounded" title="Note pour la Bible">
                  <StickyNote className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-2">
                {[0, 1, 2, 3, 4, 5, 6].map((offset) => {
                  const date = new Date(period.startDate);
                  date.setDate(date.getDate() + offset);
                  if (date > period.endDate) return null;
                  const dateStr = format(date, 'yyyy-MM-dd');
                  const dayIndex = getDay(date);
                  return (
                    <div key={dateStr} className="flex items-center gap-2">
                      <span className="text-xs text-gray-600 w-20 capitalize">{DAY_NAMES_SHORT[dayIndex === 0 ? 6 : dayIndex - 1]}</span>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={chapterInput[dateStr] ?? bibleLogMap[dateStr] ?? ''}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setChapterInput((p) => ({ ...p, [dateStr]: e.target.value }));
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

          {/* Bible book browser */}
          <Card>
            <CardContent className="p-3">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">📖 Livres de la Bible</h3>
              <Input placeholder="Rechercher un livre..." value={bibleBookFilter} onChange={(e) => setBibleBookFilter(e.target.value)} className="text-xs h-8 mb-3" />

              {/* NT */}
              <div className="mb-3">
                <button onClick={() => setExpandedTestament(expandedTestament === 'NT' ? null : 'NT')} className="flex items-center gap-2 text-xs font-semibold text-[var(--theme-primary)] w-full">
                  {expandedTestament === 'NT' ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  Nouveau Testament ({ntBooks.length} livres)
                </button>
                {expandedTestament === 'NT' && (
                  <div className="mt-1 ml-2 grid grid-cols-2 gap-1 max-h-48 overflow-y-auto">
                    {ntBooks.map((b) => (
                      <button
                        key={b.name}
                        onClick={() => { setBibleBookSelect(b.name); setBibleChapterFrom('1'); setBibleChapterTo('1'); }}
                        className="text-left text-[10px] px-2 py-1.5 rounded hover:bg-[var(--theme-primary-light)] text-gray-700 truncate transition-colors"
                      >
                        {b.name} <span className="text-gray-400">({b.chapters})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* AT */}
              <div>
                <button onClick={() => setExpandedTestament(expandedTestament === 'AT' ? null : 'AT')} className="flex items-center gap-2 text-xs font-semibold text-[var(--theme-primary)] w-full">
                  {expandedTestament === 'AT' ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  Ancien Testament ({atBooks.length} livres)
                </button>
                {expandedTestament === 'AT' && (
                  <div className="mt-1 ml-2 grid grid-cols-2 gap-1 max-h-48 overflow-y-auto">
                    {atBooks.map((b) => (
                      <button
                        key={b.name}
                        onClick={() => { setBibleBookSelect(b.name); setBibleChapterFrom('1'); setBibleChapterTo('1'); }}
                        className="text-left text-[10px] px-2 py-1.5 rounded hover:bg-[var(--theme-primary-light)] text-gray-700 truncate transition-colors"
                      >
                        {b.name} <span className="text-gray-400">({b.chapters})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ PRIERES TAB ============ */}
        <TabsContent value="prieres" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">🙏 Besoins de prière</h3>
                <Badge variant="secondary" className="text-[10px] bg-[var(--theme-primary-light)] text-[var(--theme-primary-hover)]">
                  {prayers.filter((p) => !p.resolved).length} en cours
                </Badge>
              </div>
              {prayers.length === 0 && (
                <div className="text-center py-6 text-gray-400">
                  <p className="text-sm">Aucun besoin de prière</p>
                  <p className="text-[10px] mt-1">Ajoutez vos besoins de prière ci-dessous</p>
                </div>
              )}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {prayers.map((prayer) => (
                  <div key={prayer.id} className={`flex items-start gap-2 p-2.5 rounded-lg border transition-colors ${prayer.resolved ? 'border-green-200 bg-green-50' : 'border-[var(--theme-primary)] bg-[var(--theme-primary-light)]'}`}>
                    <button
                      onClick={() => togglePrayer.mutate({ id: prayer.id, resolved: !prayer.resolved })}
                      className={`mt-0.5 shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${prayer.resolved ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-green-400'}`}
                    >
                      {prayer.resolved && <Check className="h-3 w-3" />}
                    </button>
                    <p className={`text-sm flex-1 ${prayer.resolved ? 'line-through text-gray-400' : 'text-gray-700'}`}>{prayer.text}</p>
                    <Button variant="ghost" size="icon" className="shrink-0 h-6 w-6 text-gray-300 hover:text-red-500" onClick={() => { deletePrayer.mutate(prayer.id); toast.success('Prière supprimée'); }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <div className="flex gap-2">
            <Input
              placeholder="Ajouter un besoin de prière..."
              value={newPrayerText}
              onChange={(e) => setNewPrayerText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newPrayerText.trim()) { addPrayer.mutate(newPrayerText); toast.success('Prière ajoutée'); } }}
              className="text-sm"
            />
            <Button
              onClick={() => { if (newPrayerText.trim()) { addPrayer.mutate(newPrayerText); toast.success('Prière ajoutée'); } }}
              disabled={!newPrayerText.trim()}
              className="bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-white shrink-0"
              size="icon"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Note Dialog */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StickyNote className="h-5 w-5 text-yellow-500" />
              Ajouter une note
            </DialogTitle>
            <DialogDescription>
              {noteContext.bibleRef ? `Note pour : ${noteContext.bibleRef}` : noteContext.bookId ? 'Note pour ce livre' : 'Note personnelle'}
            </DialogDescription>
          </DialogHeader>
          {noteContext.bibleRef === undefined && !noteContext.bookId && (
            <Select value={noteContext.bibleRef ? 'bible' : noteContext.bookId ? 'book' : 'general'} onValueChange={(v) => {
              if (v === 'general') setNoteContext({});
              else if (v === 'bible') setNoteContext({ bibleRef: 'Bible' });
              else if (v === 'book' && books.length > 0) setNoteContext({ bookId: books[0].id });
            }}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Type de note" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="general">📝 Note générale</SelectItem>
                <SelectItem value="bible">📖 Note Bible</SelectItem>
                {books.length > 0 && <SelectItem value="book">📚 Note livre</SelectItem>}
              </SelectContent>
            </Select>
          )}
          {(noteContext.bibleRef || noteContext.bibleRef === '') && noteContext.bookId === undefined && (
            <Select value={noteContext.bibleRef || ''} onValueChange={(v) => setNoteContext({ bibleRef: v })}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Référence biblique" /></SelectTrigger>
              <SelectContent>
                <div className="max-h-48 overflow-y-auto">
                  {BIBLE_BOOKS.map((b) => (
                    <SelectItem key={b.name} value={b.name} className="text-xs">{b.name}</SelectItem>
                  ))}
                </div>
              </SelectContent>
            </Select>
          )}
          {noteContext.bookId && books.length > 0 && !noteContext.bibleRef && (
            <Select value={noteContext.bookId} onValueChange={(v) => setNoteContext({ bookId: v })}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Choisir un livre" /></SelectTrigger>
              <SelectContent>
                {books.map((b) => (
                  <SelectItem key={b.id} value={b.id} className="text-xs">{b.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Écrivez votre note ici..."
            className="min-h-[100px] text-sm"
            autoFocus
          />
          <Button
            onClick={() => {
              if (!noteText.trim()) return;
              // Random position to avoid overlap
              const x = 10 + Math.random() * 60;
              const y = 10 + Math.random() * 60;
              addNote.mutate({ ...noteContext, content: noteText, positionX: x, positionY: y });
            }}
            disabled={!noteText.trim()}
            className="w-full bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-white text-xs"
          >
            <Plus className="h-3 w-3 mr-1" /> Ajouter la note
          </Button>
        </DialogContent>
      </Dialog>

      {/* PDF Viewer Dialog */}
      <PdfViewerDialog
        open={pdfViewerOpen}
        onOpenChange={setPdfViewerOpen}
        pdfUrl={pdfViewerUrl}
        title={pdfViewerTitle}
      />
    </div>
  );
}
