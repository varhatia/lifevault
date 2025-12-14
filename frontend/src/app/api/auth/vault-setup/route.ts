import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import prisma from '@/lib/prisma';

/**
 * @route   POST /api/auth/vault-setup
 * @desc    Mark vault setup as completed and store recovery key encrypted vault key
 * @access  Private
 * 
 * Expected payload:
 * {
 *   recoveryKeyEncryptedVaultKey: string, // JSON string of EncryptedPayload
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = typeof user.id === 'string' ? user.id : String(user.id);
    const body = await req.json();
    const { recoveryKeyEncryptedVaultKey } = body;

    // Mark vault setup as completed
    const updateData: any = {
      vaultSetupCompleted: true,
      vaultSetupCompletedAt: new Date(),
    };

    // Store recovery key encrypted vault key if provided
    if (recoveryKeyEncryptedVaultKey) {
      updateData.recoveryKeyEncryptedVaultKey = recoveryKeyEncryptedVaultKey;
      updateData.recoveryKeyGeneratedAt = new Date();
    }

    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Vault setup completion error:', error);
    return NextResponse.json(
      { error: 'Failed to mark vault setup as completed' },
      { status: 500 }
    );
  }
}

/**
 * @route   GET /api/auth/vault-setup
 * @desc    Check if user has completed vault setup
 * @access  Private
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = typeof user.id === 'string' ? user.id : String(user.id);

    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        vaultSetupCompleted: true,
        vaultSetupCompletedAt: true,
      },
    });

    return NextResponse.json({
      vaultSetupCompleted: dbUser?.vaultSetupCompleted || false,
      vaultSetupCompletedAt: dbUser?.vaultSetupCompletedAt,
    });
  } catch (error) {
    console.error('Vault setup check error:', error);
    return NextResponse.json(
      { error: 'Failed to check vault setup status' },
      { status: 500 }
    );
  }
}

