import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/api/auth';

/**
 * @route   PUT /api/vaults/my/[vaultId]/review/reminder
 * @desc    Update review reminder preferences
 * @access  Private (vault owner only)
 */
export async function PUT(
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
    const body = await req.json();
    const { frequency } = body;

    // Validate frequency
    if (frequency && !['monthly', 'quarterly', 'biannual'].includes(frequency)) {
      return NextResponse.json(
        { error: 'Invalid frequency. Must be monthly, quarterly, or biannual' },
        { status: 400 }
      );
    }

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
        { error: 'Forbidden: Only vault owner can update reminder settings' },
        { status: 403 }
      );
    }

    // Update reminder preferences (reminder always triggers on 5th, 10th, and 15th)
    const updatedVault = await prisma.myVault.update({
      where: { id: vaultId },
      data: {
        reviewReminderFrequency: frequency || null,
        // Keep reviewReminderDay for backward compatibility but it's not used
        // Reminders always trigger on 5th, 10th, and 15th of the period
      },
      select: {
        id: true,
        reviewReminderFrequency: true,
      },
    });

    // Log the activity
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        vaultType: 'my_vault',
        myVaultId: vaultId,
        action: 'review_reminder_updated',
        description: 'Review reminder preferences updated',
        metadata: {
          frequency: updatedVault.reviewReminderFrequency,
          reminderDays: [5, 10, 15], // Fixed reminder days
        },
      },
    });

    return NextResponse.json({
      success: true,
      reviewReminderFrequency: updatedVault.reviewReminderFrequency,
      message: 'Review reminder preferences updated successfully',
    });
  } catch (error) {
    console.error('Error updating review reminder preferences:', error);
    return NextResponse.json(
      { error: 'Failed to update review reminder preferences' },
      { status: 500 }
    );
  }
}

/**
 * @route   GET /api/vaults/my/[vaultId]/review/reminder
 * @desc    Get review reminder preferences
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

    const vault = await prisma.myVault.findUnique({
      where: { id: vaultId },
      select: {
        id: true,
        ownerId: true,
        reviewReminderFrequency: true,
      },
    });

    if (!vault) {
      return NextResponse.json(
        { error: 'Vault not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      reviewReminderFrequency: vault.reviewReminderFrequency || 'monthly',
      // Reminder days are fixed: 5th, 10th, and 15th of each period
      reminderDays: [5, 10, 15],
      isOwner: vault.ownerId === user.id,
    });
  } catch (error) {
    console.error('Error fetching review reminder preferences:', error);
    return NextResponse.json(
      { error: 'Failed to fetch review reminder preferences' },
      { status: 500 }
    );
  }
}

