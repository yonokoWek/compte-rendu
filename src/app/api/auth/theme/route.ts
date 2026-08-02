import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function PUT(request: Request) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;

  try {
    const { themeColor, language } = await request.json();

    const data: Record<string, string> = {};
    if (themeColor && typeof themeColor === 'string') {
      data.themeColor = themeColor;
    }
    if (language && typeof language === 'string') {
      data.language = language;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Aucune donnée à mettre à jour' }, { status: 400 });
    }

    await db.user.update({
      where: { id: auth.user.id },
      data,
    });

    return NextResponse.json({ success: true, ...data });
  } catch {
    return NextResponse.json({ error: 'Échec de la mise à jour' }, { status: 500 });
  }
}
