/**
 * @route   POST /api/admin/create-demo-account
 * @desc    Create or update demo account for testing/feedback purposes
 * @access  Admin only (should be protected in production)
 * 
 * DEMO ONLY - This endpoint creates a demo account that bypasses device authorization
 * 
 * Credentials:
 * - Email: demo1@gmail.com
 * - Password: demo@123456
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/api/auth';

const DEMO_EMAIL = 'demo1@gmail.com';
const DEMO_PASSWORD = 'demo@123456';

export async function POST(req: NextRequest) {
  try {
    // Optional: Add admin check here if needed
    // For now, allowing direct access for demo setup
    
    console.log('Creating/updating demo account...');
    
    // Check if demo account already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: DEMO_EMAIL },
    });

    const hashedPassword = await hashPassword(DEMO_PASSWORD);

    if (existingUser) {
      // Update existing account
      const updatedUser = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          hashedPassword,
          emailVerified: true,
          isActive: true,
          fullName: existingUser.fullName || 'Demo User',
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Demo account updated successfully',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          fullName: updatedUser.fullName,
        },
        credentials: {
          email: DEMO_EMAIL,
          password: DEMO_PASSWORD,
        },
        note: 'Device authorization is bypassed for this demo account',
      });
    }

    // Create new demo account
    const user = await prisma.user.create({
      data: {
        email: DEMO_EMAIL,
        hashedPassword,
        fullName: 'Demo User',
        emailVerified: true,
        isActive: true,
        vaultSetupCompleted: false,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Demo account created successfully',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      },
      credentials: {
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
      },
      note: 'Device authorization is bypassed for this demo account',
    });
  } catch (error) {
    console.error('Error creating demo account:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create demo account',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

