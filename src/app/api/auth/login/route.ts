import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { createSession } from '@/lib/auth';

function normalizePhone(contact: string): string {
  let phone = contact.replace(/[\s\-]/g, '');
  if (phone.startsWith('+')) phone = phone.slice(1);
  if (phone.startsWith('0')) phone = '243' + phone.slice(1);
  return phone;
}

export async function POST(request: Request) {
  try {
    const { contact, pin } = await request.json();

    if (!contact || !pin) {
      return NextResponse.json({ error: 'Contact et PIN requis' }, { status: 400 });
    }

    // Determine if it's a phone number or email
    let normalizedContact: string;
    if (contact.includes('@')) {
      normalizedContact = contact.trim().toLowerCase();
    } else {
      normalizedContact = normalizePhone(contact);
    }

    const user = await db.user.findUnique({ where: { contact: normalizedContact } });
    if (!user) {
      return NextResponse.json({ error: 'Identifiants invalides' }, { status: 401 });
    }

    if (user.pin !== pin) {
      return NextResponse.json({ error: 'Identifiants invalides' }, { status: 401 });
    }

    if (!user.verified) {
      return NextResponse.json({ error: 'Compte non vérifié' }, { status: 403 });
    }

    const token = await createSession(user.id);

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        contact: user.contact,
        contactType: user.contactType,
        name: user.name,
        verified: user.verified,
        themeColor: user.themeColor,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Échec de la connexion' }, { status: 500 });
  }
}
