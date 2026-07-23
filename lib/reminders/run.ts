import { buildReminders } from "@/lib/notifications/reminders";
import { sendNotification } from "@/lib/notifications/send";
import prisma from "@/lib/prisma";
import {
  REMINDABLE_STATUS,
  REMINDER_KIND,
  reminderWindow,
  shouldRemind,
} from "./schedule";

/**
 * Envoi des rappels dus.
 *
 * Déclenché par une tâche planifiée qui appelle /api/cron/reminders. La
 * fréquence n'a pas à être précise : la fenêtre est rattrapable (voir
 * schedule.ts), donc un passage toutes les quinze minutes comme toutes les
 * heures produit le même résultat, à la fraîcheur près.
 *
 * ## Réservation d'abord, envoi ensuite
 *
 * L'ordre des deux opérations est le cœur du dispositif, et il n'a pas de
 * solution parfaite — seulement un compromis à assumer :
 *
 * - envoyer puis marquer : deux passages qui se chevauchent envoient deux fois
 *   le même e-mail ;
 * - marquer puis envoyer : un échec d'envoi laisse un rappel marqué comme
 *   parti alors qu'il ne l'est pas.
 *
 * On marque d'abord — l'insertion dans `booking_reminder` *est* la
 * réservation, et c'est l'unicité `(bookingId, kind)` qui arbitre la course,
 * pas un test applicatif qui aurait sa fenêtre. Puis, si l'envoi échoue, on
 * **retire la marque** : le passage suivant réessaiera. On récupère ainsi les
 * deux propriétés, au prix d'un doublon possible dans le seul cas où l'envoi
 * réussit mais où le processus meurt avant d'avoir rendu la main.
 */

export type ReminderRun = {
  /** Cours éligibles trouvés. */
  candidates: number;
  /** Rappels effectivement partis (un cours = deux e-mails). */
  sent: number;
  /** Réclamations relâchées après échec d'envoi, à réessayer. */
  failed: number;
  /** Réclamés par un autre passage concurrent. */
  skipped: number;
};

export async function runReminders(now = new Date()): Promise<ReminderRun> {
  const { from, to } = reminderWindow(now);

  const bookings = await prisma.booking.findMany({
    where: {
      status: REMINDABLE_STATUS,
      startsAt: { gt: from, lte: to },
      // Le `some` négatif est ce qui rend le passage idempotent côté lecture ;
      // l'unicité en base le rend sûr côté écriture.
      reminders: { none: { kind: REMINDER_KIND } },
    },
    orderBy: { startsAt: "asc" },
    // Garde-fou : un premier passage après une longue interruption ne doit pas
    // tenter mille envois d'un coup. Le reste part au passage suivant.
    take: 200,
    select: {
      id: true,
      status: true,
      startsAt: true,
      isTrial: true,
      mode: true,
      meetingUrl: true,
      address: true,
      instrument: { select: { name: true } },
      teacher: {
        select: { user: { select: { name: true, email: true, timezone: true } } },
      },
      student: { select: { user: { select: { name: true, email: true } } } },
    },
  });

  const run: ReminderRun = {
    candidates: bookings.length,
    sent: 0,
    failed: 0,
    skipped: 0,
  };

  for (const booking of bookings) {
    // Filet : la requête a déjà trié, mais la règle lisible reste la référence.
    if (!shouldRemind({ ...booking, reminded: false }, now)) continue;

    let claimId: string;

    try {
      const claim = await prisma.bookingReminder.create({
        data: { bookingId: booking.id, kind: REMINDER_KIND },
        select: { id: true },
      });
      claimId = claim.id;
    } catch {
      // Violation d'unicité : un autre passage a réclamé ce rappel entre notre
      // lecture et notre écriture. C'est le mécanisme qui fonctionne, pas une
      // erreur.
      run.skipped += 1;
      continue;
    }

    const notifications = buildReminders({
      teacherName: booking.teacher.user.name,
      teacherEmail: booking.teacher.user.email,
      studentName: booking.student.user.name,
      studentEmail: booking.student.user.email,
      instrumentName: booking.instrument.name,
      startsAt: booking.startsAt,
      timezone: booking.teacher.user.timezone,
      isTrial: booking.isTrial,
      mode: booking.mode,
      meetingUrl: booking.meetingUrl,
      address: booking.address,
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    });

    const results = await Promise.all(notifications.map(sendNotification));
    const failures = results.filter((result) => !result.ok);

    if (failures.length === notifications.length) {
      // Aucun des deux n'est parti : on relâche pour réessayer. Un échec
      // partiel, lui, garde la marque — renvoyer à celui qui a bien reçu
      // serait pire que de laisser l'autre sans rappel.
      await prisma.bookingReminder.delete({ where: { id: claimId } });
      run.failed += 1;
      console.error(
        `[RAPPEL] échec pour ${booking.id} :`,
        failures.map((f) => (f.ok ? "" : f.error)).join(" | ")
      );
      continue;
    }

    run.sent += results.filter((result) => result.ok).length;
  }

  return run;
}
