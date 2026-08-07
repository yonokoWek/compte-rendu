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

    const where: Record<string, unknown> = { userId: auth.user.id };
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
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;

    const data = await request.json();
    const log = await db.bibleReadingLog.upsert({
      where: { date_userId: { date: data.date, userId: auth.user.id } },
      update: {
        chapters: data.chapters || 0,
        duration: data.duration || 0,
        reference: data.reference || '',
      },
      create: {
        date: data.date,
        chapters: data.chapters || 0,
        duration: data.duration || 0,
        reference: data.reference || '',
        userId: auth.user.id,
      },
    });
    return NextResponse.json(log);
  } catch {
    return NextResponse.json({ error: 'Failed to save bible log' }, { status: 500 });
  }
}
