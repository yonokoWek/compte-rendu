import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;

    const categories = await db.activityCategory.findMany({
      where: { userId: auth.user.id },
      orderBy: { sortOrder: 'asc' },
      include: { group: true },
    });
    const groups = await db.activityGroup.findMany({
      where: { userId: auth.user.id },
      orderBy: { sortOrder: 'asc' },
      include: { categories: { orderBy: { sortOrder: 'asc' } } },
    });
    return NextResponse.json({ categories, groups });
  } catch (error) {
    console.error('Categories GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;

    const data = await request.json();

    if (data.type === 'category') {
      const cat = await db.activityCategory.create({
        data: {
          name: data.name,
          unit: data.unit || 'minutes',
          isPersonal: data.isPersonal ?? true,
          icon: data.icon || '',
          groupId: data.groupId || null,
          userId: auth.user.id,
        },
      });
      return NextResponse.json(cat);
    }

    if (data.type === 'group') {
      const group = await db.activityGroup.create({
        data: { name: data.name, sortOrder: data.sortOrder || 0, userId: auth.user.id },
        include: { categories: true },
      });
      return NextResponse.json(group);
    }

    // Assign category to group - verify ownership
    if (data.type === 'assign') {
      const cat = await db.activityCategory.findUnique({ where: { id: data.categoryId } });
      if (!cat || cat.userId !== auth.user.id) {
        return NextResponse.json({ error: 'Non trouvé' }, { status: 404 });
      }
      if (data.groupId) {
        const group = await db.activityGroup.findUnique({ where: { id: data.groupId } });
        if (!group || group.userId !== auth.user.id) {
          return NextResponse.json({ error: 'Groupe non trouvé' }, { status: 404 });
        }
      }
      const updated = await db.activityCategory.update({
        where: { id: data.categoryId },
        data: { groupId: data.groupId || null },
        include: { group: true },
      });
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;

    const data = await request.json();

    if (data.type === 'category') {
      const cat = await db.activityCategory.findUnique({ where: { id: data.id } });
      if (!cat || cat.userId !== auth.user.id) {
        return NextResponse.json({ error: 'Non trouvé' }, { status: 404 });
      }
      const updated = await db.activityCategory.update({
        where: { id: data.id },
        data: {
          name: data.name,
          unit: data.unit,
          isPersonal: data.isPersonal,
          icon: data.icon,
          sortOrder: data.sortOrder,
          groupId: data.groupId || null,
        },
        include: { group: true },
      });
      return NextResponse.json(updated);
    }

    if (data.type === 'group') {
      const group = await db.activityGroup.findUnique({ where: { id: data.id } });
      if (!group || group.userId !== auth.user.id) {
        return NextResponse.json({ error: 'Non trouvé' }, { status: 404 });
      }
      const updated = await db.activityGroup.update({
        where: { id: data.id },
        data: { name: data.name, sortOrder: data.sortOrder },
        include: { categories: true },
      });
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    if (type === 'category') {
      const cat = await db.activityCategory.findUnique({ where: { id } });
      if (!cat || cat.userId !== auth.user.id) {
        return NextResponse.json({ error: 'Non trouvé' }, { status: 404 });
      }
      await db.activityCategory.delete({ where: { id } });
    } else if (type === 'group') {
      const group = await db.activityGroup.findUnique({ where: { id } });
      if (!group || group.userId !== auth.user.id) {
        return NextResponse.json({ error: 'Non trouvé' }, { status: 404 });
      }
      // Unassign all categories from this group first
      await db.activityCategory.updateMany({
        where: { groupId: id },
        data: { groupId: null },
      });
      await db.activityGroup.delete({ where: { id } });
    } else {
      return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
