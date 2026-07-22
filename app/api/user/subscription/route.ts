import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session || !session.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        stripePriceId: true,
        stripeCurrentPeriodEnd: true,
      },
    });

    if (!user) {
      return new NextResponse("User not found", { status: 404 });
    }

    const isActive =
      user.stripeSubscriptionId !== null &&
      user.stripeCurrentPeriodEnd !== null &&
      user.stripeCurrentPeriodEnd.getTime() > Date.now();

    return NextResponse.json({
      subscriptionId: user.stripeSubscriptionId,
      priceId: user.stripePriceId,
      currentPeriodEnd: user.stripeCurrentPeriodEnd,
      isActive,
    });
  } catch (error) {
    console.error("[USER_SUBSCRIPTION_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
