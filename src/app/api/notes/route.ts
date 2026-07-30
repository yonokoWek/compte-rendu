import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const notes = await db.readingNote.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(notes);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const note = await db.readingNote.create({
      data: {
        bookId: data.bookId || null,
        bibleRef: data.bibleRef || '',
        content: data.content,
        positionX: data.positionX ?? 50,
        positionY: data.positionY ?? 50,
      },
    });
    return NextResponse.json(note);
  } catch {
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const data = await request.json();
    const note = await db.readingNote.update({
      where: { id: data.id },
      data: {
        content: data.content,
        positionX: data.positionX,
        positionY: data.positionY,
      },
    });
    return NextResponse.json(note);
  } catch {
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    await db.readingNote.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
  }
}
