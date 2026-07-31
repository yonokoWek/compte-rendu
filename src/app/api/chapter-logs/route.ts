import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Get all book IDs for this user
    const userBooks = await db.book.findMany({
      where: { userId: auth.user.id },
      select: { id: true },
    });
    const bookIds = userBooks.map((b) => b.id);

    const where: Record<string, unknown> = {};
    if (startDate && endDate) {
      where.date = { gte: startDate, lte: endDate };
    }
    if (bookIds.length > 0) {
      where.bookId = { in: bookIds };
    } else {
      return NextResponse.json([]);
    }

    const logs = await db.bookChapterLog.findMany({ where, orderBy: { date: 'asc' } });
    return NextResponse.json(logs);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch chapter logs' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;

    const data = await request.json();

    // Verify book belongs to this user
    const book = await db.book.findUnique({ where: { id: data.bookId } });
    if (!book || book.userId !== auth.user.id) {
      return NextResponse.json({ error: 'Livre non trouvé' }, { status: 404 });
    }

    const log = await db.bookChapterLog.upsert({
      where: { date_bookId: { date: data.date, bookId: data.bookId } },
      update: { chapters: data.chapters || 0 },
      create: { date: data.date, bookId: data.bookId, chapters: data.chapters || 0 },
    });

    // Update book current chapter
    if (data.chapters && data.chapters > 0) {
      const totalLogs = await db.bookChapterLog.findMany({ where: { bookId: data.bookId } });
      const totalChapters = totalLogs.reduce((sum, l) => sum + l.chapters, 0);
      const isFinished = book.totalChapters > 0 && totalChapters >= book.totalChapters;
      await db.book.update({
        where: { id: data.bookId },
        data: { currentChapter: totalChapters, status: isFinished ? 'finished' : 'in_progress' },
      });
    }

    return NextResponse.json(log);
  } catch {
    return NextResponse.json({ error: 'Failed to save chapter log' }, { status: 500 });
  }
}
