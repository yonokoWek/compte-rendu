import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;

    const notes = await db.readingNote.findMany({
      where: { userId: auth.user.id },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(notes);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;

    const data = await request.json();

    // If bookId is provided, verify it belongs to this user
    if (data.bookId) {
      const book = await db.book.findUnique({ where: { id: data.bookId } });
      if (!book || book.userId !== auth.user.id) {
        return NextResponse.json({ error: 'Livre non trouvé' }, { status: 404 });
      }
    }

    const note = await db.readingNote.create({
      data: {
        bookId: data.bookId || null,
        bibleRef: data.bibleRef || '',
        content: data.content,
        positionX: data.positionX ?? 50,
        positionY: data.positionY ?? 50,
        userId: auth.user.id,
      },
    });
    return NextResponse.json(note);
  } catch {
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;

    const data = await request.json();
    const note = await db.readingNote.findUnique({ where: { id: data.id } });
    if (!note || note.userId !== auth.user.id) {
      return NextResponse.json({ error: 'Non trouvé' }, { status: 404 });
    }
    const updated = await db.readingNote.update({
      where: { id: data.id },
      data: {
        content: data.content,
        positionX: data.positionX,
        positionY: data.positionY,
      },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const note = await db.readingNote.findUnique({ where: { id } });
    if (!note || note.userId !== auth.user.id) {
      return NextResponse.json({ error: 'Non trouvé' }, { status: 404 });
    }

    await db.readingNote.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
  }
}
