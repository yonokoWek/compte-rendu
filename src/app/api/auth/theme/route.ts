import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function PUT(request: Request) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;

  try {
    const { themeColor } = await request.json();

    if (!themeColor || typeof themeColor !== 'string') {
      return NextResponse.json({ error: 'Couleur invalide' }, { status: 400 });
    }

    await db.user.update({
      where: { id: auth.user.id },
      data: { themeColor },
    });

    return NextResponse.json({ success: true, themeColor });
  } catch {
    return NextResponse.json({ error: 'Échec de la mise à jour' }, { status: 500 });
  }
}
