import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const categories = await db.activityCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { group: true },
    });
    const groups = await db.activityGroup.findMany({
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
    const data = await request.json();

    if (data.type === 'category') {
      const cat = await db.activityCategory.create({
        data: {
          name: data.name,
          unit: data.unit || 'minutes',
          isPersonal: data.isPersonal ?? true,
          icon: data.icon || '',
          groupId: data.groupId || null,
        },
      });
      return NextResponse.json(cat);
    }

    if (data.type === 'group') {
      const group = await db.activityGroup.create({
        data: { name: data.name, sortOrder: data.sortOrder || 0 },
        include: { categories: true },
      });
      return NextResponse.json(group);
    }

    // Assign category to group
    if (data.type === 'assign') {
      const cat = await db.activityCategory.update({
        where: { id: data.categoryId },
        data: { groupId: data.groupId || null },
        include: { group: true },
      });
      return NextResponse.json(cat);
    }

    return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const data = await request.json();

    if (data.type === 'category') {
      const cat = await db.activityCategory.update({
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
      return NextResponse.json(cat);
    }

    if (data.type === 'group') {
      const group = await db.activityGroup.update({
        where: { id: data.id },
        data: { name: data.name, sortOrder: data.sortOrder },
        include: { categories: true },
      });
      return NextResponse.json(group);
    }

    return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    if (type === 'category') {
      await db.activityCategory.delete({ where: { id } });
    } else if (type === 'group') {
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
