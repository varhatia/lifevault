import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/api/auth';
import { canCreateVault, SubscriptionPlan } from '@/lib/plan-limits';

/**
 * @route   GET /api/vaults/my
 * @desc    List all MyVault instances for the authenticated user (as owner or member)
 * @access  Private
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = String(user.id);
    
    // Get vaults where user is owner or member
    const vaults = await prisma.myVault.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { members: { some: { userId: userId, isActive: true } } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
        members: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                fullName: true,
              },
            },
          },
        },
        _count: {
          select: {
            items: true,
            nominees: true,
            members: true,
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

    // Check plan limits
    const plan = ((user as any).subscriptionPlan || "free") as SubscriptionPlan;
    const currentVaultCount = await prisma.myVault.count({
      where: { ownerId: userId },
    });

    if (!canCreateVault(plan, currentVaultCount)) {
      return NextResponse.json(
        {
          error: 'Vault limit reached',
          limitReached: true,
          limitType: 'vaults',
          currentCount: currentVaultCount,
          maxAllowed: plan === "free" ? 1 : Infinity,
          message: 'You have reached the maximum number of vaults for your plan. Please upgrade to LivPeace Plus to create more vaults.',
        },
        { status: 403 }
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
            severity: 'info',
            outcome: 'success',
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
