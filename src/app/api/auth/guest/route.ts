import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateToken } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    // Get device ID from client (stored in localStorage)
    const { deviceId } = await request.json();

    if (!deviceId) {
      return NextResponse.json({ error: 'Device ID required' }, { status: 400 });
    }

    // Find existing guest user for this device
    const existingUser = await db.user.findUnique({
      where: { contact: `guest:${deviceId}` },
    });

    if (existingUser) {
      // User exists — check for existing session
      const existingSession = await db.session.findFirst({
        where: { userId: existingUser.id, expiresAt: { gt: new Date() } },
      });

      if (existingSession) {
        return NextResponse.json({ token: existingSession.token, isGuest: true });
      }

      // Create new session
      const token = generateToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 365);

      await db.session.create({
        data: { token, userId: existingUser.id, expiresAt },
      });

      return NextResponse.json({ token, isGuest: true });
    }

    // Create new guest user
    const user = await db.user.create({
      data: {
        contact: `guest:${deviceId}`,
        contactType: 'whatsapp',
        name: '',
        pin: '',
        isGuest: true,
        verified: true, // Guests don't need verification
        themeColor: 'orange',
        language: 'fr',
      },
    });

    // Create session
    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 365);

    await db.session.create({
      data: { token, userId: user.id, expiresAt },
    });

    return NextResponse.json({ token, isGuest: true });
  } catch (error) {
    console.error('[AUTH] Guest creation error:', error);
    return NextResponse.json({ error: 'Failed to create guest session' }, { status: 500 });
  }
}
