import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const books = await db.book.findMany({
      orderBy: { createdAt: 'desc' },
      include: { chapterLogs: true, notes: true },
    });
    return NextResponse.json(books);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch books' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const book = await db.book.create({
      data: {
        title: data.title,
        author: data.author || '',
        totalChapters: data.totalChapters || 0,
        pdfUrl: data.pdfUrl || '',
      },
    });
    return NextResponse.json(book);
  } catch {
    return NextResponse.json({ error: 'Failed to create book' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const data = await request.json();
    const book = await db.book.update({
      where: { id: data.id },
      data: {
        title: data.title,
        author: data.author,
        totalChapters: data.totalChapters,
        currentChapter: data.currentChapter,
        status: data.status,
        pdfUrl: data.pdfUrl,
      },
    });
    return NextResponse.json(book);
  } catch {
    return NextResponse.json({ error: 'Failed to update book' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    await db.book.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete book' }, { status: 500 });
  }
}
