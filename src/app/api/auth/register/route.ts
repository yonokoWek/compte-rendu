import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { generateCode, normalizePhone } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { contact, contactType } = await request.json();

    if (!contact || !contactType) {
      return NextResponse.json({ error: 'Contact et type requis' }, { status: 400 });
    }

    if (contactType !== 'telegram' && contactType !== 'email') {
      return NextResponse.json({ error: 'Type invalide' }, { status: 400 });
    }

    let normalizedContact: string;
    if (contactType === 'telegram') {
      normalizedContact = normalizePhone(contact);
      const digitsOnly = normalizedContact.replace(/\D/g, '');
      if (digitsOnly.length < 9) {
        return NextResponse.json({ error: 'Numéro invalide (min 9 chiffres)' }, { status: 400 });
      }
    } else {
      normalizedContact = contact.trim().toLowerCase();
      if (!normalizedContact.includes('@')) {
        return NextResponse.json({ error: 'Email invalide' }, { status: 400 });
      }
    }

    const existing = await db.user.findUnique({ where: { contact: normalizedContact } });

    const code = generateCode();
    const codeExpiresAt = new Date();
    codeExpiresAt.setMinutes(codeExpiresAt.getMinutes() + 10);

    if (existing) {
      await db.user.update({
        where: { id: existing.id },
        data: { verificationCode: code, codeExpiresAt },
      });
    } else {
      await db.user.create({
        data: {
          contact: normalizedContact,
          contactType,
          verificationCode: code,
          codeExpiresAt,
        },
      });
    }

    // In sandbox, return the code directly instead of sending SMS/email
    return NextResponse.json({
      success: true,
      code,
      message: 'Code de vérification envoyé',
    });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json({ error: 'Échec de l\'inscription' }, { status: 500 });
  }
}
