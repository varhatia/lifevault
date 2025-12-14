import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendInactivityReminderEmail, sendNomineeInactivityNotification } from '@/lib/api/email';

/**
 * @route   GET/POST /api/nominee/access/check-inactivity
 * @desc    Check user inactivity and send reminders/notify nominees (Use Case 2)
 * @access  Internal (called by cron job or scheduled task)
 * 
 * This endpoint:
 * 1. Finds users who haven't logged in for X days (based on accessTriggerDays)
 * 2. Sends up to 3 reminder emails over 2 weeks
 * 3. After 3 reminders, notifies nominees
 * 
 * Supports both GET (Vercel Cron) and POST (external cron services)
 */
async function checkInactivity(req: NextRequest) {
  try {
    // Optional: Add authentication/authorization for cron job
    // Vercel Cron sends a special header, but we can also use Bearer token
    const authHeader = req.headers.get('authorization');
    const vercelCronHeader = req.headers.get('x-vercel-cron'); // Vercel's cron signature
    const cronSecret = process.env.CRON_SECRET;
    
    // If CRON_SECRET is set, require authentication
    if (cronSecret) {
      // Allow Vercel Cron (has x-vercel-cron header) or Bearer token
      const isVercelCron = vercelCronHeader === '1' || vercelCronHeader === 'true';
      const hasValidToken = authHeader === `Bearer ${cronSecret}`;
      
      if (!isVercelCron && !hasValidToken) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    const now = new Date();
    const results = {
      usersChecked: 0,
      remindersSent: 0,
      nomineeNotificationsSent: 0,
      errors: [] as string[],
    };

    // Get all active users with nominees
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        vaultSetupCompleted: true,
        nominees: {
          some: {
            isActive: true,
          },
        },
      },
      include: {
        nominees: {
          where: { isActive: true },
        },
        inactivityReminders: {
          where: {
            reminderType: 'user_reminder',
          },
          orderBy: {
            sentAt: 'desc',
          },
        },
      },
    });

    results.usersChecked = users.length;

    for (const user of users) {
      try {
        // Calculate days inactive
        const lastLogin = user.lastLogin || user.createdAt;
        const daysInactive = Math.floor(
          (now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Get the minimum accessTriggerDays from all nominees
        const minTriggerDays = Math.min(
          ...user.nominees.map((n) => n.accessTriggerDays)
        );

        // Skip if user hasn't been inactive long enough
        if (daysInactive < minTriggerDays) {
          continue;
        }

        // Get user reminders (only user_reminder type)
        const userReminders = user.inactivityReminders.filter(
          (r) => r.reminderType === 'user_reminder'
        );
        const reminderCount = userReminders.length;

        // Calculate days since last reminder
        const lastReminder = userReminders[0];
        const daysSinceLastReminder = lastReminder
          ? Math.floor(
              (now.getTime() - lastReminder.sentAt.getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : Infinity;

        // Send reminders: 3 reminders over 2 weeks (every ~4-5 days)
        if (reminderCount < 3 && daysSinceLastReminder >= 4) {
          // Send reminder
          try {
            await sendInactivityReminderEmail(
              user.email,
              user.fullName,
              daysInactive,
              reminderCount + 1
            );

            // Record reminder
            const userId = String(user.id); // Ensure userId is a string
            await prisma.inactivityReminder.create({
              data: {
                userId: userId,
                reminderType: 'user_reminder',
                reminderNumber: reminderCount + 1,
                daysInactive,
              },
            });

            results.remindersSent++;
          } catch (error) {
            console.error(
              `Failed to send reminder to user ${user.id}:`,
              error
            );
            results.errors.push(
              `Failed to send reminder to ${user.email}`
            );
          }
        } else if (reminderCount >= 3 && daysSinceLastReminder >= 4) {
          // After 3 reminders, notify nominees
          // Check if we've already notified nominees
          const userId = String(user.id); // Ensure userId is a string
          const nomineeNotifications = await prisma.inactivityReminder.findMany({
            where: {
              userId: userId,
              reminderType: 'nominee_notification',
            },
          });

          if (nomineeNotifications.length === 0) {
            // Notify all active nominees
            for (const nominee of user.nominees) {
              if (nominee.nomineeEmail) {
                try {
                  await sendNomineeInactivityNotification(
                    nominee.nomineeEmail,
                    nominee.nomineeName,
                    user.fullName || user.email,
                    daysInactive
                  );

                  // Record notification
                  await prisma.inactivityReminder.create({
                    data: {
                      userId: userId,
                      nomineeId: nominee.id,
                      reminderType: 'nominee_notification',
                      reminderNumber: 0, // Not applicable for nominee notifications
                      daysInactive,
                    },
                  });

                  results.nomineeNotificationsSent++;
                } catch (error) {
                  console.error(
                    `Failed to notify nominee ${nominee.id}:`,
                    error
                  );
                  results.errors.push(
                    `Failed to notify nominee ${nominee.nomineeEmail}`
                  );
                }
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error processing user ${user.id}:`, error);
        results.errors.push(`Error processing user ${user.email}`);
      }
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error('Error checking inactivity:', error);
    return NextResponse.json(
      { error: 'Failed to check inactivity' },
      { status: 500 }
    );
  }
}

// Handle GET requests (Vercel Cron sends GET)
export async function GET(req: NextRequest) {
  return checkInactivity(req);
}

// Handle POST requests (external cron services)
export async function POST(req: NextRequest) {
  return checkInactivity(req);
}

