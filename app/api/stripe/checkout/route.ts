import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { requireTeacher } from "@/lib/teacher/session";
import { isSubscriptionActive } from "@/lib/teacher/visibility";

/**
 * Souscription à l'abonnement prof.
 *
 * Le modèle économique porte sur les profs : ce sont eux les clients de la
 * plateforme, les élèves règlent leur prof hors ligne. C'est donc la seule
 * route de paiement de l'application.
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

    const priceId = process.env.STRIPE_PRICE_ID ?? process.env.NEXT_PUBLIC_STRIPE_PRICE_ID;

    if (!priceId) {
      console.error("[STRIPE_CHECKOUT] STRIPE_PRICE_ID non configuré");
      return NextResponse.json(
        { error: "Abonnement indisponible" },
        { status: 500 }
      );
    }

    const profile = await prisma.teacherProfile.findUniqueOrThrow({
      where: { id: teacher.teacherId },
      select: {
        stripeCustomerId: true,
        stripeCurrentPeriodEnd: true,
        user: { select: { email: true } },
      },
    });

    // Déjà abonné : renvoyer vers le portail plutôt que d'ouvrir un second
    // abonnement, qui serait facturé en double.
    if (isSubscriptionActive(profile.stripeCurrentPeriodEnd, new Date())) {
      return NextResponse.json(
        { error: "Un abonnement est déjà actif", alreadySubscribed: true },
        { status: 409 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      // Réutiliser le client existant : passer `customer_email` à chaque fois
      // créerait un client Stripe par tentative, et l'historique de facturation
      // du prof se retrouverait éparpillé.
      ...(profile.stripeCustomerId
        ? { customer: profile.stripeCustomerId }
        : { customer_email: profile.user.email }),
      // Seul lien entre la session et le profil, exploité par le webhook.
      metadata: { userId: teacher.userId },
      subscription_data: { metadata: { userId: teacher.userId } },
      success_url: `${appUrl}/dashboard/prof/abonnement?success=1`,
      cancel_url: `${appUrl}/dashboard/prof/abonnement?canceled=1`,
      billing_address_collection: "auto",
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[STRIPE_CHECKOUT_ERROR]", error);
    return NextResponse.json(
      { error: "Impossible d'ouvrir le paiement" },
      { status: 500 }
    );
  }
}
