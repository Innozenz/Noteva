import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

import prisma from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { mapSubscription } from "@/lib/stripe/subscription";

/**
 * Événements d'abonnement Stripe.
 *
 * Le suivi s'appuie sur les événements `customer.subscription.*`, qui portent
 * l'abonnement complet dans leur charge utile. C'est la source canonique de
 * l'état, et cela évite un aller-retour vers l'API à chaque événement — donc
 * un point de panne de moins.
 *
 * `checkout.session.completed` ne sert qu'à une chose : rattacher le client
 * Stripe au profil prof. C'est le seul moment où le lien existe, via
 * `metadata.userId` posé à la création de la session.
 *
 * Répondre 200 même quand rien n'est fait est délibéré : un 4xx ou 5xx pousse
 * Stripe à retenter indéfiniment un événement qui ne nous concerne pas.
 */

export async function POST(request: Request) {
  const body = await request.text();
  const signature = (await headers()).get("Stripe-Signature");

  if (!signature) {
    return new NextResponse("Signature manquante", { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error) {
    // Signature invalide : la requête ne vient pas de Stripe.
    const message = error instanceof Error ? error.message : "signature invalide";
    return new NextResponse(`Webhook Error: ${message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        await linkCustomer(event.data.object);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await syncSubscription(event.data.object);
        break;
      }
    }

    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error("[STRIPE_WEBHOOK_ERROR]", event.type, error);
    // Erreur de notre côté : on rend 500 pour que Stripe retente.
    return new NextResponse("Internal Error", { status: 500 });
  }
}

/**
 * Rattache le client Stripe au profil prof.
 *
 * L'état de l'abonnement lui-même n'est pas écrit ici : il arrive par
 * `customer.subscription.created`, qui peut précéder cet événement. Écrire les
 * deux ferait courir le risque qu'un ordre d'arrivée inattendu écrase l'état
 * le plus récent.
 */
async function linkCustomer(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;

  if (!userId || !customerId) return;

  await prisma.teacherProfile.updateMany({
    where: { userId },
    data: { stripeCustomerId: customerId },
  });
}

/**
 * Applique l'état d'un abonnement au profil correspondant.
 *
 * Le rattachement se fait par `stripeCustomerId` : c'est le seul identifiant
 * partagé par tous les événements d'abonnement. On accepte aussi un profil
 * déjà porteur du même `stripeSubscriptionId`, pour le cas où le client
 * n'aurait pas encore été rattaché.
 */
async function syncSubscription(subscription: Stripe.Subscription) {
  const fields = mapSubscription(subscription);

  const updated = await prisma.teacherProfile.updateMany({
    where: {
      OR: [
        { stripeCustomerId: fields.stripeCustomerId },
        { stripeSubscriptionId: fields.stripeSubscriptionId },
      ],
    },
    data: fields,
  });

  if (updated.count === 0) {
    // Aucun profil ne correspond : abonnement d'un autre produit, ou
    // checkout.session.completed pas encore reçu. Ni l'un ni l'autre n'est une
    // erreur, mais ça vaut d'être tracé.
    console.warn(
      "[STRIPE_WEBHOOK] abonnement sans profil correspondant",
      fields.stripeSubscriptionId
    );
  }
}
