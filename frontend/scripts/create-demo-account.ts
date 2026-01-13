/**
 * Script to create demo account for testing/feedback purposes
 * 
 * Usage: npx tsx scripts/create-demo-account.ts
 * 
 * This creates a demo account with:
 * - Email: demo1@gmail.com
 * - Password: demo@123456
 * - Email verified: true
 * - Device authorization: bypassed (auto-approved)
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_EMAIL = 'demo1@gmail.com';
const DEMO_PASSWORD = 'demo@123456';

async function createDemoAccount() {
  try {
    console.log('Creating demo account...');
    
    // Check if demo account already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: DEMO_EMAIL },
    });

    if (existingUser) {
      console.log('Demo account already exists. Updating password...');
      
      // Update password
      const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 12);
      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          hashedPassword,
          emailVerified: true,
          isActive: true,
        },
      });
      
      console.log('✅ Demo account password updated successfully!');
      console.log(`   Email: ${DEMO_EMAIL}`);
      console.log(`   Password: ${DEMO_PASSWORD}`);
      console.log('\n⚠️  NOTE: This is a demo account. Device authorization is bypassed for this account.');
      return;
    }

    // Create new demo account
    const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 12);
    
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

    console.log('✅ Demo account created successfully!');
    console.log(`   Email: ${DEMO_EMAIL}`);
    console.log(`   Password: ${DEMO_PASSWORD}`);
    console.log(`   User ID: ${user.id}`);
    console.log('\n⚠️  NOTE: This is a demo account. Device authorization is bypassed for this account.');
    console.log('   Users can log in and provide feedback without device verification.');
    
  } catch (error) {
    console.error('❌ Error creating demo account:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
createDemoAccount();

