import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import prisma from '@/lib/prisma';

/**
 * @route   DELETE /api/nominee/[id]
 * @desc    Delete (soft delete) a nominee
 * @access  Private
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: nomineeId } = await params;
    const userId = String(user.id);

    // Find nominee and verify ownership
    const nominee = await prisma.nominee.findFirst({
      where: {
        id: nomineeId,
        userId: userId,
      },
    });

    if (!nominee) {
      return NextResponse.json(
        { error: 'Nominee not found' },
        { status: 404 }
      );
    }

    // Soft delete (set isActive to false)
    await prisma.nominee.update({
      where: { id: nomineeId },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      message: 'Nominee removed successfully',
    });
  } catch (error) {
    console.error('Error deleting nominee:', error);
    return NextResponse.json(
      { error: 'Failed to remove nominee' },
      { status: 500 }
    );
  }
}

