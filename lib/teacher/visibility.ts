import type { ProfileStatus } from "@prisma/client";

/**
 * Visibilité d'une fiche prof.
 *
 * Elle est **dérivée**, jamais stockée : une fiche publiée dont l'abonnement
 * expire disparaît d'elle-même, sans qu'aucun webhook n'ait à réécrire un
 * statut. Il n'y a donc pas d'état à resynchroniser.
 *
 * Règle unique, partagée par la route de disponibilités, la création de
 * réservation et l'espace prof — la dupliquer, c'est se garantir qu'elle
 * divergera.
 */

export function isSubscriptionActive(
  currentPeriodEnd: Date | null,
  now: Date
): boolean {
  return currentPeriodEnd !== null && currentPeriodEnd.getTime() > now.getTime();
}

export function isTeacherVisible(
  teacher: { status: ProfileStatus; stripeCurrentPeriodEnd: Date | null } | null,
  now: Date
): boolean {
  return (
    teacher !== null &&
    teacher.status === "PUBLISHED" &&
    isSubscriptionActive(teacher.stripeCurrentPeriodEnd, now)
  );
}

/**
 * Même règle, exprimée comme filtre Prisma pour la recherche.
 *
 * Volontairement voisine de `isTeacherVisible` : une recherche qui remonterait
 * des fiches que la page individuelle refuse ensuite en 404 serait pire que
 * pas de recherche du tout. Les deux se modifient ensemble.
 */
export function visibleTeacherWhere(now: Date) {
  return {
    status: "PUBLISHED" as const,
    stripeCurrentPeriodEnd: { gt: now },
  };
}
