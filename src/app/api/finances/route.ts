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

    const entries = await db.financeEntry.findMany({
      where,
      orderBy: { date: 'desc' },
    });
    return NextResponse.json(entries);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch finances' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;

    const data = await request.json();
    const entry = await db.financeEntry.create({
      data: {
        date: data.date,
        type: data.type,
        label: data.label,
        amount: data.amount,
        category: data.category || '',
        userId: auth.user.id,
      },
    });
    return NextResponse.json(entry);
  } catch {
    return NextResponse.json({ error: 'Failed to create finance entry' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const entry = await db.financeEntry.findUnique({ where: { id } });
    if (!entry || entry.userId !== auth.user.id) {
      return NextResponse.json({ error: 'Non trouvé' }, { status: 404 });
    }

    await db.financeEntry.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete entry' }, { status: 500 });
  }
}
