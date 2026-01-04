import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/api/auth';

/**
 * @route   POST /api/vaults/my/[vaultId]/review
 * @desc    Mark vault review as complete
 * @access  Private (vault owner only)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ vaultId: string }> }
) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { vaultId } = await params;

    // Verify vault ownership
    const vault = await prisma.myVault.findUnique({
      where: { id: vaultId },
      select: { ownerId: true },
    });

    if (!vault) {
      return NextResponse.json(
        { error: 'Vault not found' },
        { status: 404 }
      );
    }

    if (vault.ownerId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: Only vault owner can complete reviews' },
        { status: 403 }
      );
    }

    // Update last reviewed timestamp
    const updatedVault = await prisma.myVault.update({
      where: { id: vaultId },
      data: {
        lastReviewedAt: new Date(),
      },
      select: {
        id: true,
        lastReviewedAt: true,
      },
    });

    // Log the review activity
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        vaultType: 'my_vault',
        myVaultId: vaultId,
        action: 'vault_review_completed',
        description: 'Vault review completed',
        metadata: {
          reviewedAt: updatedVault.lastReviewedAt,
        },
      },
    });

    return NextResponse.json({
      success: true,
      lastReviewedAt: updatedVault.lastReviewedAt,
      message: 'Vault review completed successfully',
    });
  } catch (error) {
    console.error('Error completing vault review:', error);
    return NextResponse.json(
      { error: 'Failed to complete vault review' },
      { status: 500 }
    );
  }
}

/**
 * @route   GET /api/vaults/my/[vaultId]/review
 * @desc    Get vault review status and reminder info
 * @access  Private
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ vaultId: string }> }
) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { vaultId } = await params;

    // Get vault with review info
    const vault = await prisma.myVault.findUnique({
      where: { id: vaultId },
      select: {
        id: true,
        ownerId: true,
        lastReviewedAt: true,
        reviewReminderFrequency: true,
        createdAt: true,
      },
    });

    if (!vault) {
      return NextResponse.json(
        { error: 'Vault not found' },
        { status: 404 }
      );
    }

    // Check if review is due
    const isReviewDue = checkIfReviewDue(
      vault.lastReviewedAt,
      vault.reviewReminderFrequency,
      vault.createdAt
    );

    return NextResponse.json({
      lastReviewedAt: vault.lastReviewedAt,
      reviewReminderFrequency: vault.reviewReminderFrequency || 'monthly',
      isReviewDue,
      isOwner: vault.ownerId === user.id,
    });
  } catch (error) {
    console.error('Error fetching vault review status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vault review status' },
      { status: 500 }
    );
  }
}

/**
 * Helper function to check if review is due
 * Review is due if the configured period (1 month, 3 months, or 6 months) has passed
 * since the last review (or vault creation if never reviewed)
 */
function checkIfReviewDue(
  lastReviewedAt: Date | null,
  frequency: string | null,
  vaultCreatedAt: Date
): boolean {
  const now = new Date();
  const defaultFrequency = 'monthly';
  const freq = frequency || defaultFrequency;

  // Base date: use lastReviewedAt if exists, otherwise use vaultCreatedAt
  const baseDate = lastReviewedAt || vaultCreatedAt;

  // Calculate the period duration in milliseconds
  let periodMs: number;
  if (freq === 'monthly') {
    periodMs = 30 * 24 * 60 * 60 * 1000; // ~30 days (1 month)
  } else if (freq === 'quarterly') {
    periodMs = 90 * 24 * 60 * 60 * 1000; // ~90 days (3 months)
  } else if (freq === 'biannual') {
    periodMs = 180 * 24 * 60 * 60 * 1000; // ~180 days (6 months)
  } else {
    periodMs = 30 * 24 * 60 * 60 * 1000; // Default to monthly
  }

  // Check if the period has passed since baseDate
  const timeSinceBaseDate = now.getTime() - baseDate.getTime();
  return timeSinceBaseDate >= periodMs;
}


