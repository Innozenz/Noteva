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

    // L'abonnement porte sur le prof : c'est lui le client de la plateforme.
    // Un élève n'a pas d'abonnement, on répond isActive: false sans erreur.
    const teacher = await prisma.teacherProfile.findUnique({
      where: { userId: session.user.id },
      select: {
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        stripePriceId: true,
        stripeCurrentPeriodEnd: true,
      },
    });

    if (!teacher) {
      return NextResponse.json({
        subscriptionId: null,
        priceId: null,
        currentPeriodEnd: null,
        isActive: false,
      });
    }

    const isActive =
      teacher.stripeSubscriptionId !== null &&
      teacher.stripeCurrentPeriodEnd !== null &&
      teacher.stripeCurrentPeriodEnd.getTime() > Date.now();

    return NextResponse.json({
      subscriptionId: teacher.stripeSubscriptionId,
      priceId: teacher.stripePriceId,
      currentPeriodEnd: teacher.stripeCurrentPeriodEnd,
      isActive,
    });
  } catch (error) {
    console.error("[USER_SUBSCRIPTION_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
