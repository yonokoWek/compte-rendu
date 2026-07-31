import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;

    let profile = await db.userProfile.findUnique({ where: { userId: auth.user.id } });
    if (!profile) {
      profile = await db.userProfile.create({
        data: { userId: auth.user.id, firstName: '', lastName: '', assembly: '', mentor: '' },
      });
    }
    return NextResponse.json(profile);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;

    const data = await request.json();
    let profile = await db.userProfile.findUnique({ where: { userId: auth.user.id } });
    if (profile) {
      profile = await db.userProfile.update({
        where: { id: profile.id },
        data: {
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          assembly: data.assembly || '',
          mentor: data.mentor || '',
        },
      });
    } else {
      profile = await db.userProfile.create({
        data: {
          userId: auth.user.id,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          assembly: data.assembly || '',
          mentor: data.mentor || '',
        },
      });
    }
    return NextResponse.json(profile);
  } catch {
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
