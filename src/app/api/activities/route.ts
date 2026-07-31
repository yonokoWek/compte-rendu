import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;

    const activities = await db.customActivity.findMany({
      where: { userId: auth.user.id },
      orderBy: { createdAt: 'desc' },
      include: { logs: { orderBy: { date: 'desc' } } },
    });
    return NextResponse.json(activities);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;

    const data = await request.json();
    const activity = await db.customActivity.create({
      data: {
        name: data.name,
        icon: data.icon || 'circle',
        trackMode: data.trackMode || 'count',
        userId: auth.user.id,
      },
    });
    return NextResponse.json(activity);
  } catch {
    return NextResponse.json({ error: 'Failed to create activity' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;

    const data = await request.json();
    const activity = await db.customActivity.findUnique({ where: { id: data.id } });
    if (!activity || activity.userId !== auth.user.id) {
      return NextResponse.json({ error: 'Non trouvé' }, { status: 404 });
    }
    const updated = await db.customActivity.update({
      where: { id: data.id },
      data: { name: data.name, icon: data.icon, trackMode: data.trackMode },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Failed to update activity' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const activity = await db.customActivity.findUnique({ where: { id } });
    if (!activity || activity.userId !== auth.user.id) {
      return NextResponse.json({ error: 'Non trouvé' }, { status: 404 });
    }

    await db.customActivity.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete activity' }, { status: 500 });
  }
}