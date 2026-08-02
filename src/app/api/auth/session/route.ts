import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;

  return NextResponse.json({ user: auth.user });
}
