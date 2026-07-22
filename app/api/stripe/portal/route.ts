import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { requireTeacher } from "@/lib/teacher/session";

/**
 * Portail de facturation Stripe.
 *
 * Résiliation, changement de carte, factures : tout est délégué à Stripe
 * plutôt que réimplémenté. Un prof doit pouvoir résilier sans écrire au
 * support — construire nos propres écrans pour ça n'apporterait rien et nous
 * ferait manipuler des données de paiement.
 *
 * Une résiliation revient ensuite par `customer.subscription.updated` puis
 * `deleted` ; c'est le webhook qui met l'état à jour, jamais cette route.
 */

export async function POST() {
  try {
    const teacher = await requireTeacher();

    if (!teacher.ok) {
      return NextResponse.json(
        { error: teacher.error },
        { status: teacher.status }
      );
    }

    const profile = await prisma.teacherProfile.findUniqueOrThrow({
      where: { id: teacher.teacherId },
      select: { stripeCustomerId: true },
    });

    if (!profile.stripeCustomerId) {
      return NextResponse.json(
        { error: "Aucun abonnement à gérer" },
        { status: 409 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripeCustomerId,
      return_url: `${appUrl}/dashboard/prof/abonnement`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[STRIPE_PORTAL_ERROR]", error);
    return NextResponse.json(
      { error: "Impossible d'ouvrir le portail" },
      { status: 500 }
    );
  }
}
