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

    const logs = await db.customActivityLog.findMany({
      where,
      orderBy: { date: 'desc' },
    });
    return NextResponse.json(logs);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const log = await db.customActivityLog.upsert({
      where: { date_activityId: { date: data.date, activityId: data.activityId } },
      update: { completed: data.completed ?? false, duration: data.duration || 0, note: data.note || '' },
      create: {
        date: data.date,
        activityId: data.activityId,
        completed: data.completed ?? false,
        duration: data.duration || 0,
        note: data.note || '',
      },
    });
    return NextResponse.json(log);
  } catch {
    return NextResponse.json({ error: 'Failed to save log' }, { status: 500 });
  }
}
