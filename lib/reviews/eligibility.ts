import type { BookingStatus } from "@prisma/client";

/**
 * Droit de déposer un avis.
 *
 * Une seule implémentation, comme `checkPublishable` et `checkStudentProfile` :
 * l'écran d'un élève n'affiche le bouton que quand la route l'accepterait, et
 * la route ne dépend pas de l'écran pour se protéger. Deux copies de cette
 * règle dériveraient, et la divergence se verrait au pire moment — un bouton
 * qui rend 403.
 *
 * Fonction pure : ni Prisma ni horloge. `now` est passé, ce qui rend la
 * fenêtre de dépôt testable sans attendre soixante jours.
 */

/**
 * Un avis reste ouvert deux mois après le cours.
 *
 * Ce n'est pas une contrainte technique mais un choix : un avis déposé un an
 * après ne dit plus grand-chose du prof d'aujourd'hui, et une fenêtre ouverte
 * indéfiniment transforme l'historique en levier de pression permanent. Deux
 * mois laissent largement le temps d'y penser.
 */
export const REVIEW_WINDOW_DAYS = 60;

export type ReviewableBooking = {
  status: BookingStatus;
  endsAt: Date;
  /** Profil élève propriétaire du cours. */
  studentId: string;
  /** Un avis existe déjà pour ce cours (`Review.bookingId` est unique). */
  hasReview: boolean;
};

export type ReviewBlocker =
  | "not_participant"
  | "not_completed"
  | "already_reviewed"
  | "window_closed";

export type ReviewEligibility =
  | { ok: true }
  | { ok: false; reason: ReviewBlocker; message: string };

const MESSAGES: Record<ReviewBlocker, string> = {
  not_participant: "Ce cours n'est pas le vôtre",
  not_completed:
    "Seul un cours marqué comme terminé par le prof peut être noté",
  already_reviewed: "Vous avez déjà donné votre avis sur ce cours",
  window_closed: `Les avis se ferment ${REVIEW_WINDOW_DAYS} jours après le cours`,
};

function refuse(reason: ReviewBlocker): ReviewEligibility {
  return { ok: false, reason, message: MESSAGES[reason] };
}

export function checkReviewable(
  booking: ReviewableBooking,
  studentId: string,
  now: Date
): ReviewEligibility {
  // L'appartenance d'abord : l'appelant traduit ce cas en 404, comme partout
  // ailleurs sur les réservations. Répondre « ce cours n'est pas terminé » à un
  // tiers confirmerait déjà l'existence de l'identifiant.
  if (booking.studentId !== studentId) return refuse("not_participant");

  // COMPLETED et rien d'autre. C'est le prof qui clôture, donc un avis ne peut
  // exister que sur un cours que les deux parties reconnaissent avoir eu lieu.
  // NO_SHOW en est exclu volontairement : noter un cours auquel personne n'est
  // venu ne mesure rien.
  if (booking.status !== "COMPLETED") return refuse("not_completed");

  if (booking.hasReview) return refuse("already_reviewed");

  const deadline =
    booking.endsAt.getTime() + REVIEW_WINDOW_DAYS * 24 * 3_600_000;

  if (now.getTime() > deadline) return refuse("window_closed");

  return { ok: true };
}

/** Note valide : entier de 1 à 5, comme le CHECK `review_rating_range`. */
export function isValidRating(rating: number): boolean {
  return Number.isInteger(rating) && rating >= 1 && rating <= 5;
}
