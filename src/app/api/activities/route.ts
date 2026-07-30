import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const activities = await db.customActivity.findMany({
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
    const data = await request.json();
    const activity = await db.customActivity.create({
      data: {
        name: data.name,
        icon: data.icon || 'circle',
        trackMode: data.trackMode || 'count',
      },
    });
    return NextResponse.json(activity);
  } catch {
    return NextResponse.json({ error: 'Failed to create activity' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const data = await request.json();
    const activity = await db.customActivity.update({
      where: { id: data.id },
      data: { name: data.name, icon: data.icon, trackMode: data.trackMode },
    });
    return NextResponse.json(activity);
  } catch {
    return NextResponse.json({ error: 'Failed to update activity' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    await db.customActivity.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete activity' }, { status: 500 });
  }
}
