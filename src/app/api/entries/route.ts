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

    // Get all category IDs for this user
    const userCategories = await db.activityCategory.findMany({
      where: { userId: auth.user.id },
      select: { id: true },
    });
    const categoryIds = userCategories.map((c) => c.id);

    const where: Record<string, unknown> = {};
    if (startDate && endDate) {
      where.date = { gte: startDate, lte: endDate };
    }
    if (categoryIds.length > 0) {
      where.categoryId = { in: categoryIds };
    } else {
      // No categories for this user, return empty
      return NextResponse.json([]);
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
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;

    const data = await request.json();

    // Verify category belongs to this user
    const category = await db.activityCategory.findUnique({
      where: { id: data.categoryId },
    });
    if (!category || category.userId !== auth.user.id) {
      return NextResponse.json({ error: 'Catégorie non trouvée' }, { status: 404 });
    }

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
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const categoryId = searchParams.get('categoryId');

    if (!date || !categoryId) {
      return NextResponse.json({ error: 'Missing params' }, { status: 400 });
    }

    // Verify category belongs to this user
    const category = await db.activityCategory.findUnique({
      where: { id: categoryId },
    });
    if (!category || category.userId !== auth.user.id) {
      return NextResponse.json({ error: 'Non trouvé' }, { status: 404 });
    }

    await db.dailyEntry.delete({
      where: { date_categoryId: { date, categoryId } },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete entry' }, { status: 500 });
  }
}
