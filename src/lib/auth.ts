import { db, isDatabaseConfigured } from '@/lib/db';
import { NextResponse } from 'next/server';

export interface AuthUser {
  id: string;
  contact: string;
  contactType: string;
  name: string;
  verified: boolean;
  themeColor: string;
  language: string;
  isGuest: boolean;
}

/**
 * Extract and validate session from Authorization header.
 * Returns the user object or null if not authenticated.
 * Auto-extends session expiry if within 30 days of expiration.
 */
export async function getSession(request: Request): Promise<AuthUser | null> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;

    const token = authHeader.slice(7);
    if (!token) return null;

    if (!isDatabaseConfigured()) {
      console.error('[AUTH] Database not configured, cannot validate session');
      return null;
    }

    const session = await db.session.findUnique({
      where: { token },
      include: { user: { select: { id: true, contact: true, contactType: true, name: true, verified: true, themeColor: true, language: true, isGuest: true } } },
    });

    if (!session) return null;
    if (new Date() > session.expiresAt) {
      await db.session.delete({ where: { id: session.id } });
      return null;
    }

    // Auto-extend session if within 30 days of expiration (keep-alive)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    if (session.expiresAt < thirtyDaysFromNow) {
      await db.session.update({
        where: { id: session.id },
        data: { expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) },
      });
    }

    return session.user;
  } catch (err) {
    console.error('[AUTH] getSession error:', err);
    return null;
  }
}

/**
 * Require authentication - returns user or 401 response.
 */
export async function requireAuth(request: Request): Promise<{ user: AuthUser; response: null } | { user: null; response: NextResponse }> {
  const user = await getSession(request);
  if (!user) {
    return { user: null, response: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) };
  }
  return { user, response: null };
}

/**
 * Normalize a phone number for consistent storage.
 */
export function normalizePhone(contact: string): string {
  let phone = contact.replace(/[\s\-]/g, '');
  if (phone.startsWith('+')) phone = phone.slice(1);
  if (phone.startsWith('0')) phone = '243' + phone.slice(1);
  return phone;
}

/**
 * Generate a 4-digit verification code.
 */
export function generateCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/**
 * Generate a session token.
 */
export function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Create a session for a user, returns the session token.
 */
export async function createSession(userId: string): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 365);

  await db.session.create({
    data: { token, userId, expiresAt },
  });

  return token;
}
