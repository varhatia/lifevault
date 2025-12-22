import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/api/auth';

/**
 * @route   GET /api/activity/logs
 * @desc    Get current user's activity logs (account + vaults)
 * @query   cursor?: string (id cursor), limit?: number (default 20)
 *          vaultType?: string ('account' | 'my_vault' | 'family_vault')
 *          action?: string
 *          from?: ISO date string (inclusive)
 *          to?: ISO date string (inclusive)
 * @access  Private
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get('limit');
    const cursorParam = searchParams.get('cursor');
    const vaultTypeParam = searchParams.get('vaultType');
    const actionParam = searchParams.get('action');
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    const limit = Math.min(Math.max(Number(limitParam) || 20, 1), 100);

    const where: any = {
      userId: String(user.id),
    };

    if (vaultTypeParam) {
      where.vaultType = vaultTypeParam;
    }
    if (actionParam) {
      where.action = actionParam;
    }
    if (fromParam || toParam) {
      where.createdAt = {};
      if (fromParam) {
        const fromDate = new Date(fromParam);
        if (!isNaN(fromDate.getTime())) {
          where.createdAt.gte = fromDate;
        }
      }
      if (toParam) {
        const toDate = new Date(toParam);
        if (!isNaN(toDate.getTime())) {
          where.createdAt.lte = toDate;
        }
      }
    }

    const logs = await prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1, // one extra to know if next page exists
      ...(cursorParam
        ? {
            cursor: {
              id: cursorParam,
            },
            skip: 1,
          }
        : {}),
    });

    let nextCursor: string | null = null;
    if (logs.length > limit) {
      const nextItem = logs[logs.length - 1];
      nextCursor = nextItem.id;
      logs.pop();
    }

    return NextResponse.json({
      logs,
      nextCursor,
    });
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity logs' },
      { status: 500 }
    );
  }
}


