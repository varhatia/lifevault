import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendAccessRequestEmail } from '@/lib/api/email';
import crypto from 'crypto';

/**
 * @route   POST /api/nominee/access/request
 * @desc    Nominee requests access to vault (Use Case 1)
 * @access  Public (nominee doesn't need to be logged in)
 * 
 * Expected payload:
 * {
 *   userEmail: string, // Email of vault owner
 *   nomineeName: string,
 *   nomineeEmail?: string,
 *   nomineePhone?: string,
 *   relationship: string, // e.g., "Spouse", "Child", "Attorney"
 *   reasonForAccess: string,
 *   nomineeId?: string // Optional: specific nominee ID if multiple vaults exist
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userEmail,
      nomineeName,
      nomineeEmail,
      nomineePhone,
      relationship,
      reasonForAccess,
      nomineeId, // Optional: specific nominee ID if multiple vaults exist
    } = body;

    // Validation
    if (!userEmail || !nomineeName || !relationship || !reasonForAccess) {
      return NextResponse.json(
        { error: 'Missing required fields: userEmail, nomineeName, relationship, reasonForAccess' },
        { status: 400 }
      );
    }

    if (!nomineeEmail && !nomineePhone) {
      return NextResponse.json(
        { error: 'Either nomineeEmail or nomineePhone is required' },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      include: {
        nominees: {
          where: {
            isActive: true,
          },
          include: {
            familyVault: {
              select: {
                id: true,
                name: true,
              },
            },
            myVault: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // If nomineeId is provided, use it directly (vault already selected)
    let nominee: any;
    if (nomineeId) {
      nominee = user.nominees.find((n: any) => n.id === nomineeId);
      if (!nominee) {
        return NextResponse.json(
          { error: 'Invalid nominee ID or you are not a nominee for this vault' },
          { status: 403 }
        );
      }
    } else {
      // Find all matching nominees (same person can be nominee for multiple vaults)
      const matchingNominees = user.nominees.filter(
        (n: any) =>
          (nomineeEmail && n.nomineeEmail === nomineeEmail) ||
          (nomineePhone && n.nomineePhone === nomineePhone)
      );

      if (matchingNominees.length === 0) {
        return NextResponse.json(
          { error: 'You are not designated as a nominee for this account' },
          { status: 403 }
        );
      }

      // If multiple nominees found, return them for vault selection
      if (matchingNominees.length > 1) {
        return NextResponse.json({
          multipleVaults: true,
          nominees: matchingNominees.map((n: any) => ({
            id: n.id,
            vaultType: n.vaultType,
            vaultId: n.vaultId,
            vaultName: n.vaultType === 'family_vault' && n.familyVault
              ? n.familyVault.name
              : n.vaultType === 'my_vault' && n.myVault
              ? n.myVault.name
              : 'Personal Vault',
          })),
          message: 'You are a nominee for multiple vaults. Please select which vault you want to request access for.',
        }, { status: 200 });
      }

      // Single nominee - proceed with request
      nominee = matchingNominees[0];
    }

    // Check if there's already a pending request
    const existingRequest = await prisma.nomineeAccessRequest.findFirst({
      where: {
        nomineeId: nominee.id,
        status: 'pending',
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (existingRequest) {
      return NextResponse.json(
        { error: 'You already have a pending access request' },
        { status: 400 }
      );
    }

    // Generate approval token
    const approvalToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

    // Create access request
    const userId = String(user.id); // Ensure userId is a string
    const accessRequest = await prisma.nomineeAccessRequest.create({
      data: {
        nomineeId: nominee.id,
        userId: userId,
        nomineeName: nomineeName.trim(),
        nomineeEmail: nomineeEmail?.trim() || null,
        nomineePhone: nomineePhone?.trim() || null,
        relationship: relationship.trim(),
        reasonForAccess: reasonForAccess.trim(),
        approvalToken,
        expiresAt,
        status: 'pending',
      },
    });

    // Send notification email to user
    try {
      await sendAccessRequestEmail(
        user.email,
        user.fullName,
        nomineeName,
        relationship,
        reasonForAccess,
        approvalToken
      );
    } catch (error) {
      console.error('Failed to send access request email:', error);
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      message: 'Access request submitted successfully. The vault owner will be notified.',
      requestId: accessRequest.id,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating access request:', error);
    return NextResponse.json(
      { error: 'Failed to create access request' },
      { status: 500 }
    );
  }
}

