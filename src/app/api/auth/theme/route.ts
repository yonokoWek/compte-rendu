import { db, isDatabaseConfigured } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function PUT(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;

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

    if (isDatabaseConfigured()) {
      await db.user.update({
        where: { id: auth.user.id },
        data,
      });
    }

    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    console.error('[AUTH] Theme update error:', error);
    return NextResponse.json({ error: 'Échec de la mise à jour' }, { status: 500 });
  }
}
