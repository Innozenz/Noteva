/**
 * Ce qui fait « nouvelle » un cours, pour l'élève.
 *
 * Le prof a sa pastille de demandes en attente ; l'élève n'avait rien, et
 * apprenait une confirmation, un refus ou une annulation seulement par e-mail.
 * Un cours porte une nouvelle quand **le prof a tranché depuis la dernière
 * visite** de « Mes cours » (`coursSeenAt`) :
 *
 * - confirmé après cette date (`confirmedAt`) ;
 * - refusé après cette date (pas d'horodatage dédié, mais un cours refusé est
 *   terminal : son `updatedAt` date bien le refus) ;
 * - annulé après cette date **par le prof**, pas par l'élève lui-même — d'où le
 *   filtre sur `cancelledById`, sans quoi l'élève serait notifié de sa propre
 *   annulation.
 *
 * Règle unique, partagée par le compteur de la barre latérale et le marqueur
 * « Nouveau » sur chaque carte, pour qu'ils ne divergent pas.
 */
export type StudentNewsBooking = {
  status: string;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  cancelledById: string | null;
  updatedAt: Date;
};

export function isStudentNews(
  booking: StudentNewsBooking,
  seenAt: Date,
  studentUserId: string
): boolean {
  switch (booking.status) {
    case "CONFIRMED":
      return booking.confirmedAt !== null && booking.confirmedAt > seenAt;
    case "DECLINED":
      return booking.updatedAt > seenAt;
    case "CANCELLED":
      return (
        booking.cancelledAt !== null &&
        booking.cancelledAt > seenAt &&
        booking.cancelledById !== studentUserId
      );
    default:
      return false;
  }
}
