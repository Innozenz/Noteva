import { describe, expect, it } from "vitest";
import type Stripe from "stripe";

import { isEntitled, mapSubscription } from "./subscription";

/** Abonnement minimal, dans la forme rendue par l'API v20. */
function subscription(
  overrides: {
    status?: Stripe.Subscription.Status;
    periodEnd?: number | null;
    customer?: string | { id: string };
    priceId?: string;
    withoutItems?: boolean;
  } = {}
): Stripe.Subscription {
  const {
    status = "active",
    periodEnd = 1_800_000_000,
    customer = "cus_123",
    priceId = "price_123",
    withoutItems = false,
  } = overrides;

  return {
    id: "sub_123",
    status,
    customer,
    items: withoutItems
      ? { data: [] }
      : {
          data: [
            {
              // En v20 la fin de période est portée par l'item.
              current_period_end: periodEnd,
              price: { id: priceId },
            },
          ],
        },
  } as unknown as Stripe.Subscription;
}

describe("isEntitled", () => {
  it("donne accès aux statuts actifs", () => {
    for (const status of ["active", "trialing"] as const) {
      expect(isEntitled(status)).toBe(true);
    }
  });

  it("laisse `past_due` donner accès", () => {
    // Stripe retente le paiement plusieurs jours : couper au premier échec de
    // carte serait brutal, et la date de fin de période borne le risque.
    expect(isEntitled("past_due")).toBe(true);
  });

  it("coupe l'accès sur les statuts terminaux", () => {
    for (const status of [
      "canceled",
      "unpaid",
      "incomplete",
      "incomplete_expired",
      "paused",
    ] as const) {
      expect(isEntitled(status)).toBe(false);
    }
  });
});

describe("mapSubscription", () => {
  it("extrait les identifiants et la date de fin", () => {
    expect(mapSubscription(subscription())).toEqual({
      stripeSubscriptionId: "sub_123",
      stripeCustomerId: "cus_123",
      stripePriceId: "price_123",
      stripeCurrentPeriodEnd: new Date(1_800_000_000 * 1000),
    });
  });

  it("lit la fin de période sur l'item, pas sur l'abonnement", () => {
    const result = mapSubscription(subscription({ periodEnd: 1_900_000_000 }));

    expect(result.stripeCurrentPeriodEnd).toEqual(
      new Date(1_900_000_000 * 1000)
    );
  });

  it("efface la date quand l'abonnement est résilié", () => {
    // Sinon la fiche resterait visible jusqu'à la fin de période déjà payée,
    // alors que l'abonnement n'existe plus.
    expect(
      mapSubscription(subscription({ status: "canceled" }))
        .stripeCurrentPeriodEnd
    ).toBeNull();
  });

  it("efface la date sur un impayé définitif", () => {
    expect(
      mapSubscription(subscription({ status: "unpaid" })).stripeCurrentPeriodEnd
    ).toBeNull();
  });

  it("conserve la date sur un `past_due`", () => {
    expect(
      mapSubscription(subscription({ status: "past_due" }))
        .stripeCurrentPeriodEnd
    ).not.toBeNull();
  });

  it("accepte un client développé en objet", () => {
    expect(
      mapSubscription(subscription({ customer: { id: "cus_obj" } }))
        .stripeCustomerId
    ).toBe("cus_obj");
  });

  it("ne casse pas sur un abonnement sans item", () => {
    const result = mapSubscription(subscription({ withoutItems: true }));

    expect(result.stripePriceId).toBeNull();
    expect(result.stripeCurrentPeriodEnd).toBeNull();
  });
});
