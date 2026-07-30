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

    const logs = await db.bibleReadingLog.findMany({ where, orderBy: { date: 'asc' } });
    return NextResponse.json(logs);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch bible logs' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const log = await db.bibleReadingLog.upsert({
      where: { date: data.date },
      update: {
        chapters: data.chapters || 0,
        reference: data.reference || '',
      },
      create: {
        date: data.date,
        chapters: data.chapters || 0,
        reference: data.reference || '',
      },
    });
    return NextResponse.json(log);
  } catch {
    return NextResponse.json({ error: 'Failed to save bible log' }, { status: 500 });
  }
}
