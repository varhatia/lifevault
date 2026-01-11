import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api/auth";
import prisma from "@/lib/prisma";

/**
 * @route   POST /api/account/upgrade
 * @desc    Upgrade user account to Plus plan with 3 months free
 * @access  Private
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user with subscription plan to check current status
    const userWithPlan = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
      },
    });

    if (!userWithPlan) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user is already on Plus plan
    if (userWithPlan.subscriptionPlan === "plus") {
      return NextResponse.json(
        { 
          error: "Account is already upgraded to Plus plan",
          alreadyUpgraded: true 
        },
        { status: 400 }
      );
    }

    // Calculate expiration date (3 months from now)
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 3);

    // Update user's subscription
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionPlan: "plus",
        subscriptionStatus: "active",
        subscriptionExpiresAt: expiresAt,
      },
      select: {
        id: true,
        email: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
      },
    });

    // Log the upgrade activity
    try {
      const ipAddress =
        req.headers.get("x-forwarded-for") ||
        req.headers.get("x-real-ip") ||
        null;
      const userAgent = req.headers.get("user-agent") || null;

      await prisma.activityLog.create({
        data: {
          userId: user.id,
          vaultType: "account",
          action: "account_upgraded",
          description: "Account upgraded to Plus plan with 3 months free access",
          ipAddress,
          userAgent,
          metadata: {
            severity: "info",
            outcome: "success",
            plan: "plus",
            expiresAt: expiresAt.toISOString(),
            freePeriod: "3 months",
            earlyAccess: true,
          },
          createdAt: new Date(),
        },
      });
    } catch (logError) {
      console.error("Failed to log upgrade activity:", logError);
      // Don't fail the upgrade if logging fails
    }

    return NextResponse.json({
      success: true,
      message: "Account successfully upgraded to LivPeace Plus",
      subscription: {
        plan: updatedUser.subscriptionPlan,
        status: updatedUser.subscriptionStatus,
        expiresAt: updatedUser.subscriptionExpiresAt,
      },
    });
  } catch (error) {
    console.error("Error upgrading account:", error);
    return NextResponse.json(
      { error: "Failed to upgrade account. Please try again." },
      { status: 500 }
    );
  }
}

