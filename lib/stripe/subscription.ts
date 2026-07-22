import type Stripe from "stripe";

/**
 * Traduction d'un abonnement Stripe vers les colonnes de TeacherProfile.
 *
 * Isolée et pure : c'est le point où une erreur passe inaperçue le plus
 * longtemps — un mauvais champ de date et une fiche reste visible des mois
 * après un impayé, ou disparaît alors que le prof a payé.
 *
 * En API v20, la fin de période vit sur l'item d'abonnement et non sur
 * l'abonnement lui-même. C'est le piège principal de ce mapping.
 */

export type SubscriptionFields = {
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  stripePriceId: string | null;
  stripeCurrentPeriodEnd: Date | null;
};

/**
 * Statuts qui donnent droit au service. `past_due` en fait partie
 * volontairement : Stripe retente le paiement plusieurs jours, et couper la
 * visibilité d'un prof au premier échec de carte serait brutal. La date de fin
 * de période fait de toute façon office de garde-fou.
 */
const ENTITLED_STATUSES: Stripe.Subscription.Status[] = [
  "active",
  "trialing",
  "past_due",
];

export function isEntitled(status: Stripe.Subscription.Status): boolean {
  return ENTITLED_STATUSES.includes(status);
}

export function mapSubscription(
  subscription: Stripe.Subscription
): SubscriptionFields {
  const item = subscription.items?.data?.[0];

  // Un abonnement résilié ou impayé ne doit plus donner accès : on efface la
  // date plutôt que de la laisser dans le futur, sinon la fiche resterait
  // visible jusqu'à l'échéance déjà payée.
  const periodEnd =
    isEntitled(subscription.status) && item?.current_period_end
      ? new Date(item.current_period_end * 1000)
      : null;

  return {
    stripeSubscriptionId: subscription.id,
    stripeCustomerId:
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id,
    stripePriceId: item?.price?.id ?? null,
    stripeCurrentPeriodEnd: periodEnd,
  };
}
