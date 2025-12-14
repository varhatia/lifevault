import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import prisma from '@/lib/prisma';
import { storePartB, hasPartB } from '@/lib/api/key-storage';

/**
 * @route   GET /api/nominee
 * @desc    Get current nominee configuration
 * @access  Private
 */
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = String(user.id); // Ensure userId is a string

  // Optional query params to filter by vault type and vault ID
  const { searchParams } = new URL(req.url);
  const vaultTypeParam = searchParams.get('vaultType');
  const vaultIdParam = searchParams.get('vaultId');
  
  // Allow filtering by isActive status (default to active only, but can show all or inactive)
  const includeInactive = searchParams.get('includeInactive') === 'true';
  const onlyInactive = searchParams.get('onlyInactive') === 'true';
  
  const whereClause: any = { userId: userId };
  
  // Filter by active status
  if (onlyInactive) {
    whereClause.isActive = false;
  } else if (!includeInactive) {
    whereClause.isActive = true; // Default: only active nominees
  }
  // If includeInactive is true, don't filter by isActive (show all)
  
  if (vaultTypeParam && ['my_vault', 'family_vault'].includes(vaultTypeParam)) {
    whereClause.vaultType = vaultTypeParam;
  }
  if (vaultIdParam) {
    // For my_vault, check myVaultId
    if (vaultTypeParam === 'my_vault') {
      whereClause.myVaultId = vaultIdParam;
    } else if (vaultTypeParam === 'family_vault') {
      // For family_vault, check familyVaultId
      whereClause.familyVaultId = vaultIdParam;
    } else {
      // Fallback to vaultId if vaultType is not specified
      whereClause.vaultId = vaultIdParam;
    }
  }

  const nominees = await prisma.nominee.findMany({
    where: whereClause,
    select: {
      id: true,
      vaultType: true,
      vaultId: true,
      nomineeName: true,
      nomineeEmail: true,
      nomineePhone: true,
      accessTriggerDays: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
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
      // Don't return nomineeKeyPartC for security (use get-key endpoint)
      // Note: notifyNominee field doesn't exist in schema - email is always sent if email is provided
    },
    orderBy: { createdAt: 'desc' },
  });

  // Group nominees by email/phone to show which vaults they're assigned to
  const groupedNominees = nominees.reduce((acc: any, nominee) => {
    const key = nominee.nomineeEmail || nominee.nomineePhone || nominee.id;
    if (!acc[key]) {
      acc[key] = {
        nomineeName: nominee.nomineeName,
        nomineeEmail: nominee.nomineeEmail,
        nomineePhone: nominee.nomineePhone,
        vaults: [],
      };
    }
    acc[key].vaults.push({
      id: nominee.id,
      vaultType: nominee.vaultType,
      vaultId: nominee.vaultId,
      vaultName: nominee.vaultType === 'family_vault' && nominee.familyVault
        ? nominee.familyVault.name
        : 'Personal Vault',
      accessTriggerDays: nominee.accessTriggerDays,
      createdAt: nominee.createdAt,
      updatedAt: nominee.updatedAt,
    });
    return acc;
  }, {});

  return NextResponse.json({ 
    nominees,
    groupedNominees: Object.values(groupedNominees), // Grouped by email/phone for UI
  });
}

/**
 * @route   POST /api/nominee
 * @desc    Add a new nominee
 * @access  Private
 * 
 * Expected payload:
 * {
 *   vaultType: "my_vault" | "family_vault",
 *   vaultId?: string,  // Required for family_vault, null for my_vault
 *   nomineeName: string,
 *   nomineeEmail?: string,
 *   nomineePhone?: string,
 *   nomineeKeyPartC: string,  // Generated client-side using Shamir Secret Sharing
 *   accessTriggerDays?: number, // Default 90 days
 *   notifyNominee: boolean     // Whether to send notification email/SMS
 * }
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = String(user.id); // Ensure userId is a string

  try {
    const body = await req.json();
    const {
      vaultType,
      vaultId,
      nomineeName,
      nomineeEmail,
      nomineePhone,
      nomineeKeyPartC, // This is now encrypted (JSON string of EncryptedPayload)
      serverKeyPartB, // Part B from Shamir Secret Sharing (plaintext, will be encrypted server-side)
      accessTriggerDays = 90,
    } = body;

    // Validate vaultType
    if (!vaultType || !['my_vault', 'family_vault'].includes(vaultType)) {
      return NextResponse.json(
        { error: 'vaultType must be either "my_vault" or "family_vault"' },
        { status: 400 }
      );
    }

    // Validate vaultId for both vault types
    if (!vaultId) {
      return NextResponse.json(
        { error: 'vaultId is required' },
        { status: 400 }
      );
    }

    // Verify user has access to the vault
    if (vaultType === 'my_vault') {
      const vault = await prisma.myVault.findFirst({
        where: {
          id: vaultId,
          ownerId: userId,
        },
      });

      if (!vault) {
        return NextResponse.json(
          { error: 'MyVault not found or you do not have access' },
          { status: 403 }
        );
      }
    } else if (vaultType === 'family_vault') {
      const vault = await prisma.familyVault.findFirst({
        where: {
          id: vaultId,
          OR: [
            { ownerId: userId },
            { members: { some: { userId: userId, isActive: true, role: 'admin' } } },
          ],
        },
      });

      if (!vault) {
        return NextResponse.json(
          { error: 'Family vault not found or you do not have admin access' },
          { status: 403 }
        );
      }
    }

    // Validation
    if (!nomineeName || nomineeName.trim().length === 0) {
      return NextResponse.json(
        { error: 'Nominee name is required' },
        { status: 400 }
      );
    }

    if (!nomineeEmail && !nomineePhone) {
      return NextResponse.json(
        { error: 'Either email or phone number is required' },
        { status: 400 }
      );
    }

    if (!nomineeKeyPartC) {
      return NextResponse.json(
        { error: 'Nominee key part C is required' },
        { status: 400 }
      );
    }

    if (!serverKeyPartB) {
      return NextResponse.json(
        { error: 'Server key part B is required' },
        { status: 400 }
      );
    }

    // Validate email format if provided
    if (nomineeEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(nomineeEmail)) {
        return NextResponse.json(
          { error: 'Invalid email format' },
          { status: 400 }
        );
      }
    }

    // Validate phone format if provided (basic validation - allow digits, +, spaces, dashes)
    if (nomineePhone) {
      const cleanedPhone = nomineePhone.replace(/[\s-()]/g, '');
      const phoneRegex = /^\+?[1-9]\d{6,14}$/; // E.164 format (7-15 digits after +)
      if (!phoneRegex.test(cleanedPhone)) {
        return NextResponse.json(
          { error: 'Invalid phone number format. Please use international format (e.g., +1234567890)' },
          { status: 400 }
        );
      }
    }

    // Check if the same nominee (email/phone) already exists across ALL vaults (MyVault + FamilyVault) for this user
    // Match if: (email matches) OR (phone matches) - if either matches, it's a duplicate
    // User can still proceed after seeing the warning (like MyVault behavior)
    const trimmedEmail = nomineeEmail?.trim();
    const trimmedPhone = nomineePhone?.trim();
    
    // Build conditions for email/phone matching
    // Match if email OR phone matches (either one is enough to consider it a duplicate)
    const emailPhoneConditions: any[] = [];
    if (trimmedEmail) {
      emailPhoneConditions.push({ nomineeEmail: trimmedEmail.toLowerCase() });
    }
    if (trimmedPhone) {
      // Compare against the stored format (trimmed, not normalized)
      // The database stores phone numbers as provided by the user
      emailPhoneConditions.push({ nomineePhone: trimmedPhone });
    }
    
    // Check for duplicates across ALL vault types (both my_vault and family_vault)
    let existingNominee = null;
    if (emailPhoneConditions.length > 0) {
      // Check across ALL vaults of the user (not just same type - both MyVault and FamilyVault)
      const existingNomineeWhere: any = {
        userId: userId,
        isActive: true,
        // Don't filter by vaultType - check across all vault types
        OR: emailPhoneConditions, // Match if email OR phone matches
      };

      try {
        existingNominee = await prisma.nominee.findFirst({
          where: existingNomineeWhere,
          select: {
            id: true,
            vaultType: true,
            vaultId: true,
            myVaultId: true,
            familyVaultId: true,
            nomineeEmail: true,
            nomineePhone: true,
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
          orderBy: {
            createdAt: 'desc', // Get the most recent one if multiple matches
          },
        });
      } catch (queryError) {
        console.error('Error checking for duplicate nominee:', queryError);
        // Don't fail the entire request if duplicate check fails - just log it and continue
      }
    }

    // Store Part B if not already stored (first nominee) or if key rotation is needed
    // Part B is shared across all nominees for a user
    const userHasPartB = await hasPartB(userId);
    if (!userHasPartB) {
      // First nominee - store Part B
      await storePartB(userId, serverKeyPartB, 1); // Key version 1
    }
    // TODO: In future, support key rotation - check if keyVersion needs update

    // Create nominee record
    const nomineeData: any = {
      userId: userId,
      vaultType,
      nomineeName: nomineeName.trim(),
      nomineeEmail: nomineeEmail?.trim() || null,
      nomineePhone: nomineePhone?.trim() || null,
      nomineeKeyPartC, // Store the encrypted key part
      accessTriggerDays,
      isActive: true,
    };

    // Set vault-specific ID fields
    // Note: Don't set vaultId if it has a foreign key constraint - use only myVaultId/familyVaultId
    if (vaultType === 'my_vault' && vaultId) {
      nomineeData.myVaultId = vaultId;
      // Don't set vaultId - it may have a foreign key constraint that conflicts
      // nomineeData.vaultId = vaultId; // Removed to avoid FK constraint violation
    } else if (vaultType === 'family_vault' && vaultId) {
      nomineeData.familyVaultId = vaultId;
      // Don't set vaultId - it may have a foreign key constraint that conflicts
      // nomineeData.vaultId = vaultId; // Removed to avoid FK constraint violation
    }

    const nominee = await prisma.nominee.create({
      data: nomineeData,
      select: {
        id: true,
        vaultType: true,
        vaultId: true,
        nomineeName: true,
        nomineeEmail: true,
        nomineePhone: true,
        accessTriggerDays: true,
        createdAt: true,
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
    });

    // Prepare response with duplicate warning if applicable
    const responseData: any = {
      success: true,
      nominee,
    };

    // Show warning if duplicate nominee found across ANY vault (MyVault or FamilyVault)
    // User can still proceed after seeing the warning (like MyVault behavior)
    if (existingNominee) {
      const existingVaultName = existingNominee.vaultType === 'family_vault' && existingNominee.familyVault
        ? existingNominee.familyVault.name
        : existingNominee.vaultType === 'my_vault' && existingNominee.myVault
        ? existingNominee.myVault.name
        : 'a vault';
      
      const vaultTypeLabel = existingNominee.vaultType === 'family_vault' ? 'Family Vault' : 'My Vault';
      
      // Build a more descriptive warning message with actual email/phone values
      const matchingFields: string[] = [];
      const matchingValues: string[] = [];
      
      if (trimmedEmail && existingNominee.nomineeEmail && 
          existingNominee.nomineeEmail.toLowerCase() === trimmedEmail.toLowerCase()) {
        matchingFields.push('email');
        matchingValues.push(`email ${trimmedEmail}`);
      }
      if (trimmedPhone && existingNominee.nomineePhone && 
          existingNominee.nomineePhone.trim() === trimmedPhone) {
        matchingFields.push('phone');
        matchingValues.push(`phone ${trimmedPhone}`);
      }
      
      const matchDescription = matchingValues.length > 0 
        ? ` (matching ${matchingValues.join(' and ')})`
        : '';
      
      responseData.warning = `This nominee${matchDescription} is already assigned to ${vaultTypeLabel}: ${existingVaultName}. They will receive separate keys for each vault assignment.`;
      responseData.existingNominee = {
        id: String(existingNominee.id),
        vaultType: existingNominee.vaultType,
        vaultName: existingVaultName,
        vaultId: existingNominee.vaultId || existingNominee.myVaultId || existingNominee.familyVaultId || null,
      };
    }

    // Always send notification email if email is provided (MVP: ensure nominee gets the key)
    // User can choose to notify later, but we always send the key for security
    if (nomineeEmail) {
      try {
        const { sendNomineeNotificationEmail } = await import('@/lib/api/email');
        
        // Get vault name for both vault types
        let vaultName: string | undefined;
        if (vaultType === 'family_vault' && vaultId) {
          const vault = await prisma.familyVault.findUnique({
            where: { id: vaultId },
            select: { name: true },
          });
          vaultName = vault?.name;
        } else if (vaultType === 'my_vault' && vaultId) {
          const vault = await prisma.myVault.findUnique({
            where: { id: vaultId },
            select: { name: true },
          });
          vaultName = vault?.name;
        }
        
        await sendNomineeNotificationEmail(
          nomineeEmail,
          nomineeName,
          user.fullName || user.email,
          vaultType === 'family_vault' ? 'family_vault' : 'my_vault',
          vaultName,
          nomineeKeyPartC // Send encrypted Part C in email (password shared separately by user)
        );
      } catch (error) {
        console.error('Failed to send nominee notification:', error);
        // Don't fail the request if notification fails, but log it
      }
    } else if (nomineePhone) {
      // TODO: Add SMS notification if phone is provided
      console.log(`SMS notification would be sent to ${nomineePhone} (not implemented yet)`);
      console.warn('Nominee key Part C stored but not delivered. User must manually deliver the key.');
    } else {
      console.warn('Nominee key Part C stored but no delivery method available. User must manually deliver the key.');
    }

    return NextResponse.json(responseData, { status: 201 });
  } catch (error) {
    console.error('Error adding nominee:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorDetails = error instanceof Error ? error.stack : undefined;
    console.error('Error details:', errorDetails);
    return NextResponse.json(
      { 
        error: `Failed to add nominee: ${errorMessage}`,
        details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
      },
      { status: 500 }
    );
  }
}
