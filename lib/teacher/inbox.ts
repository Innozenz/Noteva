import type { BookingStatus } from "@prisma/client";

/**
 * Regroupement des cours pour la boîte de réception du prof.
 *
 * Fonction pure : c'est elle qui décide de l'ordre de traitement, et l'ordre
 * est le fond du sujet. Une demande en attente immobilise un créneau
 * (booking_teacher_no_overlap) — la laisser traîner revient à bloquer son
 * propre agenda, donc elle passe avant tout le reste.
 */

export type InboxBooking = {
  id: string;
  status: BookingStatus;
  startsAt: Date;
  endsAt: Date;
};

export type InboxGroups<T extends InboxBooking> = {
  /** Demandes à trancher. Les plus proches d'abord : ce sont les plus urgentes. */
  pending: T[];
  /** Cours confirmés encore à venir. */
  upcoming: T[];
  /** Cours confirmés déjà passés, à clôturer (honoré ou non). */
  toReview: T[];
  /** Tout le reste : annulé, refusé, terminé, non honoré. */
  past: T[];
};

export function groupBookings<T extends InboxBooking>(
  bookings: T[],
  now: Date
): InboxGroups<T> {
  const groups: InboxGroups<T> = {
    pending: [],
    upcoming: [],
    toReview: [],
    past: [],
  };

  for (const booking of bookings) {
    const isOver = booking.endsAt.getTime() <= now.getTime();

    if (booking.status === "PENDING") {
      // Une demande dont l'heure est passée sans réponse n'est plus à
      // confirmer : elle rejoint l'historique, où le prof peut la refuser.
      (isOver ? groups.past : groups.pending).push(booking);
      continue;
    }

    if (booking.status === "CONFIRMED") {
      (isOver ? groups.toReview : groups.upcoming).push(booking);
      continue;
    }

    groups.past.push(booking);
  }

  const byStartAsc = (a: T, b: T) => a.startsAt.getTime() - b.startsAt.getTime();
  const byStartDesc = (a: T, b: T) => b.startsAt.getTime() - a.startsAt.getTime();

  groups.pending.sort(byStartAsc);
  groups.upcoming.sort(byStartAsc);
  // Les plus récemment terminés en tête : c'est ce qu'on clôture en premier.
  groups.toReview.sort(byStartDesc);
  groups.past.sort(byStartDesc);

  return groups;
}

/**
 * Une demande devient urgente quand le cours approche : passé ce seuil, ne pas
 * répondre revient à répondre non, et le créneau reste bloqué pour rien.
 */
export function isUrgent(booking: InboxBooking, now: Date, hours = 48): boolean {
  if (booking.status !== "PENDING") return false;

  const remaining = booking.startsAt.getTime() - now.getTime();

  return remaining > 0 && remaining <= hours * 3_600_000;
}
