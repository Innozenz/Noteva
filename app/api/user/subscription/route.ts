import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isSubscriptionActive } from "@/lib/teacher/visibility";

/**
 * État de l'abonnement de l'utilisateur courant.
 *
 * `isActive` vient de `isSubscriptionActive`, l'implémentation unique. Cette
 * route réinlinait la règle avec une condition de plus — elle exigeait aussi un
 * `stripeSubscriptionId` — et les deux définitions avaient donc divergé : la
 * fiche pouvait être publiquement visible pendant que cet écran annonçait
 * « abonnement inactif » et proposait de souscrire une seconde fois. C'est
 * exactement la dérive que l'implémentation unique existe pour empêcher.
 */
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // L'abonnement porte sur le prof : c'est lui le client de la plateforme.
    // Un élève n'a pas d'abonnement, on répond isActive: false sans erreur.
    const teacher = await prisma.teacherProfile.findUnique({
      where: { userId: session.user.id },
      select: {
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

    return NextResponse.json({
      subscriptionId: teacher.stripeSubscriptionId,
      priceId: teacher.stripePriceId,
      currentPeriodEnd: teacher.stripeCurrentPeriodEnd,
      isActive: isSubscriptionActive(teacher.stripeCurrentPeriodEnd, new Date()),
    });
  } catch (error) {
    console.error("[USER_SUBSCRIPTION_ERROR]", error);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
