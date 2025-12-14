import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendAccessDecisionEmail } from '@/lib/api/email';

/**
 * @route   GET /api/nominee/access/approve
 * @desc    Approve nominee access request (Use Case 1)
 * @access  Public (accessed via email link)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Approval token is required' },
        { status: 400 }
      );
    }

    // Find access request by token
    const accessRequest = await prisma.nomineeAccessRequest.findUnique({
      where: { approvalToken: token },
      include: {
        user: true,
        nominee: true,
      },
    });

    if (!accessRequest) {
      return NextResponse.json(
        { error: 'Invalid or expired approval token' },
        { status: 404 }
      );
    }

    if (accessRequest.status !== 'pending') {
      return NextResponse.json(
        { error: `This request has already been ${accessRequest.status}` },
        { status: 400 }
      );
    }

    if (accessRequest.expiresAt < new Date()) {
      // Mark as expired
      await prisma.nomineeAccessRequest.update({
        where: { id: accessRequest.id },
        data: { status: 'expired' },
      });
      return NextResponse.json(
        { error: 'This request has expired' },
        { status: 400 }
      );
    }

    // Approve the request
    await prisma.nomineeAccessRequest.update({
      where: { id: accessRequest.id },
      data: {
        status: 'approved',
        approvedAt: new Date(),
      },
    });

    // Send notification to nominee
    if (accessRequest.nomineeEmail) {
      try {
        await sendAccessDecisionEmail(
          accessRequest.nomineeEmail,
          accessRequest.nomineeName,
          accessRequest.user.fullName || accessRequest.user.email,
          true, // approved
          accessRequest.id // Pass accessRequestId for unlock
        );
      } catch (error) {
        console.error('Failed to send approval email:', error);
      }
    }

    // Redirect to success page or return JSON
    return NextResponse.redirect(
      new URL(
        `/nominee-access?approved=true&requestId=${accessRequest.id}`,
        req.url
      )
    );
  } catch (error) {
    console.error('Error approving access request:', error);
    return NextResponse.json(
      { error: 'Failed to approve access request' },
      { status: 500 }
    );
  }
}

