import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    let profile = await db.userProfile.findFirst();
    if (!profile) {
      profile = await db.userProfile.create({
        data: { firstName: '', lastName: '', assembly: '', mentor: '' },
      });
    }
    return NextResponse.json(profile);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const data = await request.json();
    let profile = await db.userProfile.findFirst();
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
