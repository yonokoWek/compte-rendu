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

    // Get all activity IDs for this user
    const userActivities = await db.customActivity.findMany({
      where: { userId: auth.user.id },
      select: { id: true },
    });
    const activityIds = userActivities.map((a) => a.id);

    const where: Record<string, unknown> = {};
    if (startDate && endDate) {
      where.date = { gte: startDate, lte: endDate };
    }
    if (activityIds.length > 0) {
      where.activityId = { in: activityIds };
    } else {
      return NextResponse.json([]);
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
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;

    const data = await request.json();

    // Verify activity belongs to this user
    const activity = await db.customActivity.findUnique({
      where: { id: data.activityId },
    });
    if (!activity || activity.userId !== auth.user.id) {
      return NextResponse.json({ error: 'Activité non trouvée' }, { status: 404 });
    }

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
