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

    const entries = await db.dailyEntry.findMany({
      where,
      include: { category: true },
      orderBy: { date: 'asc' },
    });

    return NextResponse.json(entries);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch entries' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const entry = await db.dailyEntry.upsert({
      where: {
        date_categoryId: {
          date: data.date,
          categoryId: data.categoryId,
        },
      },
      update: { value: data.value ?? 0, note: data.note ?? '' },
      create: {
        date: data.date,
        categoryId: data.categoryId,
        value: data.value ?? 0,
        note: data.note ?? '',
      },
      include: { category: true },
    });
    return NextResponse.json(entry);
  } catch {
    return NextResponse.json({ error: 'Failed to save entry' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const categoryId = searchParams.get('categoryId');

    if (!date || !categoryId) {
      return NextResponse.json({ error: 'Missing params' }, { status: 400 });
    }

    await db.dailyEntry.delete({
      where: { date_categoryId: { date, categoryId } },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete entry' }, { status: 500 });
  }
}
