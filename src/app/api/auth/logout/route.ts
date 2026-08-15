import { db, isDatabaseConfigured } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;

    if (isDatabaseConfigured()) {
      await db.session.deleteMany({ where: { userId: auth.user.id } });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[AUTH] Logout error:', error);
    return NextResponse.json({ success: true }); // Logout should always succeed
  }
}
