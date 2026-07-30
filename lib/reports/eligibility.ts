import type { BookingStatus } from "@prisma/client";

/**
 * Un cours est « documentable » (le prof peut y écrire un compte rendu) quand
 * il a réellement eu lieu : confirmé ou terminé, et commencé.
 *
 * Pur, `now` injecté — même raison que le reste des règles du domaine.
 *
 * - PENDING : pas encore confirmé, rien à raconter.
 * - CANCELLED / DECLINED / NO_SHOW : aucun cours n'a eu lieu.
 * - CONFIRMED / COMPLETED **et** `startsAt <= now` : le cours a commencé, le
 *   prof peut le documenter (souvent juste après, avant même de le clôturer).
 */
export function canDocument(
  status: BookingStatus,
  startsAt: Date,
  now: Date
): boolean {
  if (status !== "CONFIRMED" && status !== "COMPLETED") return false;
  return startsAt.getTime() <= now.getTime();
}
