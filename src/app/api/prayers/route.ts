import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const prayers = await db.prayerNeed.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(prayers);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch prayers' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const prayer = await db.prayerNeed.create({
      data: { text: data.text },
    });
    return NextResponse.json(prayer);
  } catch {
    return NextResponse.json({ error: 'Failed to create prayer' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const data = await request.json();
    const prayer = await db.prayerNeed.update({
      where: { id: data.id },
      data: { text: data.text, resolved: data.resolved },
    });
    return NextResponse.json(prayer);
  } catch {
    return NextResponse.json({ error: 'Failed to update prayer' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    await db.prayerNeed.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete prayer' }, { status: 500 });
  }
}
