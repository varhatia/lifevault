import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { retrievePartB } from '@/lib/api/key-storage';
import { combineTwoOfThree } from '@/lib/crypto';
import { NOMINEE_COOKIE_NAME, signNomineeToken } from '@/lib/api/auth';

/**
 * @route   POST /api/nominee/unlock
 * @desc    Start nominee unlock flow - combine Part C with Part B to reconstruct master key
 * @access  Public (nominee access, but requires verification)
 * 
 * Expected payload:
 * {
 *   accessRequestId: string, // Access request ID from approval email
 *   encryptedPartC: string, // Encrypted Part C (JSON string)
 *   decryptionPassword: string, // Password to decrypt Part C
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      accessRequestId,
      encryptedPartC,
      decryptionPassword,
    } = body;

    // Validation
    if (!accessRequestId || !encryptedPartC || !decryptionPassword) {
      return NextResponse.json(
        { error: 'Missing required fields: accessRequestId, encryptedPartC, decryptionPassword' },
        { status: 400 }
      );
    }

    // Find access request and verify it's approved
    const accessRequest = await prisma.nomineeAccessRequest.findUnique({
      where: { id: accessRequestId },
      include: {
        nominee: {
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
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });

    if (!accessRequest) {
      return NextResponse.json(
        { error: 'Invalid access request ID' },
        { status: 404 }
      );
    }

    if (accessRequest.status !== 'approved') {
      return NextResponse.json(
        { error: `Access request is ${accessRequest.status}. Only approved requests can unlock the vault.` },
        { status: 403 }
      );
    }

    // Check if request has expired
    if (accessRequest.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'This access request has expired' },
        { status: 403 }
      );
    }

    const nominee = accessRequest.nominee;
    const userId = accessRequest.userId;

    if (!nominee || !nominee.isActive) {
      return NextResponse.json(
        { error: 'Nominee not found or inactive' },
        { status: 404 }
      );
    }

    // Access request is already verified above (must be approved)
    // For Use Case 2 (inactivity), we'll need a different endpoint or mechanism
    // For now, we only support Use Case 1 (approved access request)

    // Retrieve Part B from secure storage
    const serverKeyPartB = await retrievePartB(userId);
    if (!serverKeyPartB) {
      return NextResponse.json(
        { error: 'Server key Part B not found. Vault may not be configured for nominee access.' },
        { status: 404 }
      );
    }

    // Decrypt Part C using nominee's password
    // Note: In a more secure implementation, Part C decryption should happen client-side
    // For MVP, we'll decrypt server-side but this should be moved to client in production
    try {
      const { deriveKeyFromPasswordServer, decryptWithAesServer } = await import('@/lib/api/crypto');
      const encryptionKey = await deriveKeyFromPasswordServer(decryptionPassword);
      const encryptedPayload = JSON.parse(encryptedPartC);
      const nomineeKeyPartC = decryptWithAesServer(encryptedPayload, encryptionKey);

      // Combine Part B + Part C using Shamir Secret Sharing (2-of-3)
      const shares = [
        { id: 1, value: serverKeyPartB }, // Part B
        { id: 2, value: nomineeKeyPartC }, // Part C
      ];
      
      const reconstructedKey = combineTwoOfThree(shares); // hex string of AES key

      // Mark unlock as initiated
      await prisma.nominee.update({
        where: { id: nominee.id },
        data: {
          unlockInitiatedAt: new Date(),
        },
      });

      // Create nominee read-only session token
      const nomineeToken = signNomineeToken(userId, nominee.id);

      const res = NextResponse.json({
        success: true,
        message: 'Vault unlocked successfully',
        unlocked: true,
        readOnly: true, // Nominee access is always read-only
        // Reconstructed AES key (hex). Client will import this into Web Crypto
        // and use it to decrypt vault items in a read-only view.
        reconstructedKeyHex: reconstructedKey,
        userId,
        nomineeId: nominee.id,
        vaultType: nominee.vaultType, // "my_vault" or "family_vault"
        vaultId: nominee.vaultType === 'family_vault' ? nominee.familyVaultId : nominee.myVaultId,
        vaultName: nominee.vaultType === 'family_vault' && nominee.familyVault
          ? nominee.familyVault.name
          : nominee.vaultType === 'my_vault' && nominee.myVault
          ? nominee.myVault.name
          : 'Personal Vault',
      });

      res.cookies.set(NOMINEE_COOKIE_NAME, nomineeToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60, // 1 hour
      });

      return res;
    } catch (decryptError) {
      console.error('Failed to decrypt Part C:', decryptError);
      console.error('Error details:', {
        error: decryptError instanceof Error ? decryptError.message : String(decryptError),
        stack: decryptError instanceof Error ? decryptError.stack : undefined,
        encryptedPartCLength: encryptedPartC?.length,
        hasDecryptionPassword: !!decryptionPassword,
      });
      return NextResponse.json(
        { 
          error: 'Invalid decryption password or corrupted Part C',
          details: process.env.NODE_ENV === 'development' 
            ? (decryptError instanceof Error ? decryptError.message : String(decryptError))
            : undefined,
        },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Nominee unlock error:', error);
    return NextResponse.json(
      { error: 'Failed to unlock vault' },
      { status: 500 }
    );
  }
}

