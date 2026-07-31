import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;

    const books = await db.book.findMany({
      where: { userId: auth.user.id },
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
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;

    const data = await request.json();
    const book = await db.book.create({
      data: {
        title: data.title,
        author: data.author || '',
        totalChapters: data.totalChapters || 0,
        pdfUrl: data.pdfUrl || '',
        userId: auth.user.id,
      },
    });
    return NextResponse.json(book);
  } catch {
    return NextResponse.json({ error: 'Failed to create book' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;

    const data = await request.json();
    const book = await db.book.findUnique({ where: { id: data.id } });
    if (!book || book.userId !== auth.user.id) {
      return NextResponse.json({ error: 'Non trouvé' }, { status: 404 });
    }
    const updated = await db.book.update({
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
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Failed to update book' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const book = await db.book.findUnique({ where: { id } });
    if (!book || book.userId !== auth.user.id) {
      return NextResponse.json({ error: 'Non trouvé' }, { status: 404 });
    }

    await db.book.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete book' }, { status: 500 });
  }
}
