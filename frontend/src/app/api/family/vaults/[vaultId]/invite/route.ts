import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
// import { prisma } from '@/lib/prisma';

/**
 * @route   POST /api/family/vaults/:vaultId/invite
 * @desc    Invite a family member
 * @access  Private
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ vaultId: string }> }
) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // TODO: Verify user is vault owner or admin
  // TODO: Create FamilyMember and send invite
  const { vaultId } = await params;
  const body = await req.json().catch(() => ({}));
  
  return NextResponse.json({ 
    status: 'stub', 
    message: 'Family member invite endpoint - to be implemented',
    vault_id: vaultId,
    payload: body 
  });
}

