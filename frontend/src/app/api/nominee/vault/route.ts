import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getNomineeSessionFromRequest } from '@/lib/api/auth';

/**
 * @route   GET /api/nominee/vault
 * @desc    List items in vault for nominee (read-only)
 * @access  Nominee session (lv_nominee cookie)
 * 
 * Query params:
 * - type: "my_vault" | "family_vault"
 * - vaultId: string (required for family_vault)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getNomineeSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(req.url);
    const vaultType = searchParams.get('type') || 'my_vault';
    const vaultId = searchParams.get('vaultId');

    // Verify nominee has access to this vault
    const whereClause: any = {
      id: session.nomineeId,
      userId: session.userId,
      vaultType: vaultType as 'my_vault' | 'family_vault',
      isActive: true,
    };

    // For family vault, check familyVaultId; for my vault, check myVaultId
    if (vaultType === 'family_vault' && vaultId) {
      whereClause.familyVaultId = vaultId;
    } else if (vaultType === 'my_vault') {
      // For my vault, we can check myVaultId if provided, or just verify the nominee exists
      // The myVaultId will be used later to fetch items
    }

    const nominee = await prisma.nominee.findFirst({
      where: whereClause,
    });

    if (!nominee) {
      return NextResponse.json(
        { error: 'Nominee does not have access to this vault' },
        { status: 403 }
      );
    }

    let items: any[] = [];
    let vaultName: string | null = null;

    if (vaultType === 'family_vault' && vaultId) {
      // Fetch family vault items
      const familyItems = await prisma.familyVaultItem.findMany({
        where: {
          familyVaultId: vaultId,
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          category: true,
          title: true,
          tags: true,
          s3Key: true,
          iv: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      items = familyItems;

      // Get vault name
      const vault = await prisma.familyVault.findUnique({
        where: { id: vaultId },
        select: { name: true },
      });
      vaultName = vault?.name || null;
    } else {
      // Fetch my vault items - use myVaultId directly
      const myVaultId = nominee.myVaultId;
      if (myVaultId) {
        items = await prisma.vaultItem.findMany({
          where: {
            myVaultId: myVaultId,
            myVault: {
              ownerId: session.userId,
            },
          },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            category: true,
            title: true,
            tags: true,
            s3Key: true,
            iv: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        // Get vault name
        const vault = await prisma.myVault.findUnique({
          where: { id: myVaultId },
          select: { name: true },
        });
        vaultName = vault?.name || null;
      }
    }

    return NextResponse.json({
      items,
      readOnly: true,
      ownerId: session.userId,
      nomineeId: session.nomineeId,
      vaultType,
      vaultId: vaultType === 'family_vault' ? vaultId : null,
      vaultName,
    });
  } catch (error) {
    console.error('Error fetching nominee vault items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch nominee vault items' },
      { status: 500 }
    );
  }
}


