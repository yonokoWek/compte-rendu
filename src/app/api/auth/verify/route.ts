import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { createSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { contact, code, pin, name } = await request.json();

    if (!contact || !code || !pin) {
      return NextResponse.json({ error: 'Contact, code et PIN requis' }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { contact } });
    if (!user) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    if (!user.verificationCode || user.verificationCode !== code) {
      return NextResponse.json({ error: 'Code invalide' }, { status: 400 });
    }

    if (user.codeExpiresAt && new Date() > user.codeExpiresAt) {
      return NextResponse.json({ error: 'Code expiré' }, { status: 400 });
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        verified: true,
        pin,
        name: name || user.name,
        verificationCode: '',
        codeExpiresAt: null,
      },
    });

    // Create UserProfile if not exists
    const existingProfile = await db.userProfile.findUnique({ where: { userId: user.id } });
    if (!existingProfile) {
      await db.userProfile.create({
        data: { userId: user.id, firstName: '', lastName: '', assembly: '', mentor: '' },
      });
    }

    const token = await createSession(user.id);

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        contact: user.contact,
        contactType: user.contactType,
        name: name || user.name,
        verified: true,
        themeColor: user.themeColor,
      },
    });
  } catch (error) {
    console.error('Verify error:', error);
    return NextResponse.json({ error: 'Échec de la vérification' }, { status: 500 });
  }
}
