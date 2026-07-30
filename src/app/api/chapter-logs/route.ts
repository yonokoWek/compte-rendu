import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: Record<string, unknown> = {};
    if (startDate && endDate) {
      where.date = { gte: startDate, lte: endDate };
    }

    const logs = await db.bookChapterLog.findMany({ where, orderBy: { date: 'asc' } });
    return NextResponse.json(logs);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch chapter logs' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const log = await db.bookChapterLog.upsert({
      where: { date_bookId: { date: data.date, bookId: data.bookId } },
      update: { chapters: data.chapters || 0 },
      create: { date: data.date, bookId: data.bookId, chapters: data.chapters || 0 },
    });

    // Update book current chapter
    if (data.chapters && data.chapters > 0) {
      const book = await db.book.findUnique({ where: { id: data.bookId } });
      if (book) {
        const totalLogs = await db.bookChapterLog.findMany({ where: { bookId: data.bookId } });
        const totalChapters = totalLogs.reduce((sum, l) => sum + l.chapters, 0);
        const isFinished = book.totalChapters > 0 && totalChapters >= book.totalChapters;
        await db.book.update({
          where: { id: data.bookId },
          data: { currentChapter: totalChapters, status: isFinished ? 'finished' : 'in_progress' },
        });
      }
    }

    return NextResponse.json(log);
  } catch {
    return NextResponse.json({ error: 'Failed to save chapter log' }, { status: 500 });
  }
}
