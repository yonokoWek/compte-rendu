import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const user = await getSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    return NextResponse.json({ user });
  } catch (error) {
    console.error('[AUTH] Session check error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
