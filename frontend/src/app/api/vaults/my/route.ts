import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/api/auth';

/**
 * @route   GET /api/vaults/my
 * @desc    List all MyVault instances for the authenticated user
 * @access  Private
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = String(user.id);
    const vaults = await prisma.myVault.findMany({
      where: { 
        ownerId: userId,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            items: true,
            nominees: true,
          },
        },
      },
    });
    
    return NextResponse.json({ vaults });
  } catch (error) {
    console.error('Error fetching my vaults:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vaults' },
      { status: 500 }
    );
  }
}

/**
 * @route   POST /api/vaults/my
 * @desc    Create a new MyVault instance
 * @access  Private
 * 
 * Expected payload:
 * {
 *   name: string,
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = String(user.id);
    const body = await req.json();
    const { name } = body;
    
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Vault name is required' },
        { status: 400 }
      );
    }
    
    const vault = await prisma.myVault.create({
      data: {
        name: name.trim(),
        ownerId: userId,
      },
      include: {
        _count: {
          select: {
            items: true,
            nominees: true,
          },
        },
      },
    });

    // Log MyVault creation
    try {
      const now = new Date();
      await (prisma as any).activityLog.create({
        data: {
          userId,
          vaultType: 'my_vault',
          myVaultId: vault.id,
          action: 'myvault_created',
          description: 'Personal vault created',
          ipAddress:
            req.headers.get('x-forwarded-for') ||
            req.headers.get('x-real-ip') ||
            null,
          userAgent: req.headers.get('user-agent') || null,
          metadata: {
            name: vault.name,
          },
          createdAt: now,
        },
      });
    } catch (logError) {
      console.error('Failed to log MyVault creation:', logError);
    }

    return NextResponse.json({
      success: true,
      vault,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating my vault:', error);
    return NextResponse.json(
      { error: 'Failed to create vault' },
      { status: 500 }
    );
  }
}
