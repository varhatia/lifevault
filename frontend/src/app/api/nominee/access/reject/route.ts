import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendAccessDecisionEmail } from '@/lib/api/email';

/**
 * @route   GET /api/nominee/access/reject
 * @desc    Reject nominee access request (Use Case 1)
 * @access  Public (accessed via email link)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    const reason = searchParams.get('reason') || 'Request rejected by vault owner';

    if (!token) {
      return NextResponse.json(
        { error: 'Rejection token is required' },
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
        { error: 'Invalid or expired rejection token' },
        { status: 404 }
      );
    }

    if (accessRequest.status !== 'pending') {
      return NextResponse.json(
        { error: `This request has already been ${accessRequest.status}` },
        { status: 400 }
      );
    }

    // Reject the request
    await prisma.nomineeAccessRequest.update({
      where: { id: accessRequest.id },
      data: {
        status: 'rejected',
        rejectedAt: new Date(),
        rejectedReason: reason,
      },
    });

    // Send notification to nominee
    if (accessRequest.nomineeEmail) {
      try {
        await sendAccessDecisionEmail(
          accessRequest.nomineeEmail,
          accessRequest.nomineeName,
          accessRequest.user.fullName || accessRequest.user.email,
          false, // rejected
          undefined, // No accessRequestId for rejected requests
          reason
        );
      } catch (error) {
        console.error('Failed to send rejection email:', error);
      }
    }

    // Redirect to success page or return JSON
    return NextResponse.redirect(
      new URL(
        `/nominee-access?rejected=true&requestId=${accessRequest.id}`,
        req.url
      )
    );
  } catch (error) {
    console.error('Error rejecting access request:', error);
    return NextResponse.json(
      { error: 'Failed to reject access request' },
      { status: 500 }
    );
  }
}

