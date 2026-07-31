import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export interface AuthUser {
  id: string;
  contact: string;
  contactType: string;
  name: string;
  verified: boolean;
  themeColor: string;
}

/**
 * Extract and validate session from Authorization header.
 * Returns the user object or null if not authenticated.
 */
export async function getSession(request: Request): Promise<AuthUser | null> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;

    const token = authHeader.slice(7);
    if (!token) return null;

    const session = await db.session.findUnique({
      where: { token },
      include: { user: { select: { id: true, contact: true, contactType: true, name: true, verified: true, themeColor: true } } },
    });

    if (!session) return null;
    if (new Date() > session.expiresAt) {
      await db.session.delete({ where: { id: session.id } });
      return null;
    }

    return session.user;
  } catch {
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
  expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

  await db.session.create({
    data: { token, userId, expiresAt },
  });

  return token;
}
