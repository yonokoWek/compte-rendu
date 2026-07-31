import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;

    const prayers = await db.prayerNeed.findMany({
      where: { userId: auth.user.id },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(prayers);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch prayers' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;

    const data = await request.json();
    const prayer = await db.prayerNeed.create({
      data: { text: data.text, userId: auth.user.id },
    });
    return NextResponse.json(prayer);
  } catch {
    return NextResponse.json({ error: 'Failed to create prayer' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;

    const data = await request.json();
    const prayer = await db.prayerNeed.findUnique({ where: { id: data.id } });
    if (!prayer || prayer.userId !== auth.user.id) {
      return NextResponse.json({ error: 'Non trouvé' }, { status: 404 });
    }
    const updated = await db.prayerNeed.update({
      where: { id: data.id },
      data: { text: data.text, resolved: data.resolved },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Failed to update prayer' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const prayer = await db.prayerNeed.findUnique({ where: { id } });
    if (!prayer || prayer.userId !== auth.user.id) {
      return NextResponse.json({ error: 'Non trouvé' }, { status: 404 });
    }

    await db.prayerNeed.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete prayer' }, { status: 500 });
  }
}
