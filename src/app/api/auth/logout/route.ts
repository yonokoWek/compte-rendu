import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;

  await db.session.deleteMany({ where: { userId: auth.user.id } });

  return NextResponse.json({ success: true });
}
