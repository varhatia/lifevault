import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'dev-jwt-secret-change-in-production';
// Reduced to 30 minutes to align with inactivity timeout (15 min) + buffer
// Client-side inactivity monitor will handle the 15-minute timeout
const JWT_EXPIRY = '30m';

export const AUTH_COOKIE_NAME = 'lv_auth';
export const NOMINEE_COOKIE_NAME = 'lv_nominee';

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

type AuthTokenPayload = {
  sub: string; // userId
  email: string;
};

type NomineeTokenPayload = {
  sub: string; // userId (vault owner)
  nomineeId: string;
  type: 'nominee';
};

export function signAuthToken(userId: string, email: string): string {
  const payload: AuthTokenPayload = { sub: userId, email };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

export function verifyAuthToken(token: string): AuthTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
  } catch {
    return null;
  }
}

export function signNomineeToken(userId: string, nomineeId: string): string {
  const payload: NomineeTokenPayload = { sub: userId, nomineeId, type: 'nominee' };
  // Shorter expiry for nominee sessions (e.g., 1 day)
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
}

export function verifyNomineeToken(token: string): NomineeTokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as NomineeTokenPayload;
    if (decoded.type !== 'nominee') {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export async function getUserFromRequest(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  const decoded = verifyAuthToken(token);
  if (!decoded) return null;

  const user = await prisma.user.findUnique({
    where: { id: decoded.sub, isActive: true },
    select: {
      id: true,
      email: true,
      fullName: true,
      isActive: true,
      emailVerified: true,
      vaultSetupCompleted: true,
      vaultSetupCompletedAt: true,
      createdAt: true,
    },
  });

  if (!user || !user.isActive) return null;

  // Return with explicit types to avoid TypeScript inference issues
  return {
    id: user.id as string,
    email: user.email as string,
    fullName: user.fullName as string | null,
    isActive: user.isActive as boolean,
    emailVerified: user.emailVerified as boolean,
    vaultSetupCompleted: user.vaultSetupCompleted as boolean,
    vaultSetupCompletedAt: user.vaultSetupCompletedAt as Date | null,
    createdAt: user.createdAt as Date,
  };
}

export async function getNomineeSessionFromRequest(req: NextRequest) {
  const token = req.cookies.get(NOMINEE_COOKIE_NAME)?.value;
  if (!token) return null;

  const decoded = verifyNomineeToken(token);
  if (!decoded) return null;

  // Optionally verify nominee is still active
  const nominee = await prisma.nominee.findFirst({
    where: {
      id: decoded.nomineeId,
      userId: decoded.sub,
      isActive: true,
    },
    select: {
      id: true,
      userId: true,
      nomineeName: true,
      nomineeEmail: true,
    },
  });

  if (!nominee) return null;

  return {
    userId: nominee.userId,
    nomineeId: nominee.id,
    nomineeName: nominee.nomineeName,
    nomineeEmail: nominee.nomineeEmail,
  };
}

