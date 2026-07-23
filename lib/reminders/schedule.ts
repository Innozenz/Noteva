import type { BookingStatus, ReminderKind } from "@prisma/client";

/**
 * Fenêtre de rappel.
 *
 * Fonction pure, `now` injecté : c'est ce qui permet de tester le
 * comportement d'une tâche planifiée sans attendre l'heure dite.
 *
 * Le choix déterminant est la **forme** de la fenêtre. La tentation est de
 * viser l'instant : « les cours qui commencent dans 24 h ± 5 min ». Cela
 * suppose que la tâche tourne exactement à l'heure, toujours. Une panne de
 * vingt minutes, un redémarrage, un déploiement, et les cours tombés dans le
 * trou ne reçoivent jamais rien — sans aucun symptôme, puisque rien n'a
 * échoué.
 *
 * La fenêtre est donc **ouverte vers le bas** : tout cours qui commence entre
 * maintenant et maintenant + 24 h et qui n'a pas encore été rappelé. Une tâche
 * interrompue six heures rattrape son retard au passage suivant. L'unicité en
 * base garantit qu'un rappel déjà envoyé ne repart pas.
 */

/** Combien de temps avant le cours on prévient. */
export const REMINDER_LEAD_HOURS = 24;

export const REMINDER_KIND: ReminderKind = "H24";

/** Seuls les cours confirmés sont rappelés : une demande n'est pas un cours. */
export const REMINDABLE_STATUS: BookingStatus = "CONFIRMED";

export type ReminderWindow = { from: Date; to: Date };

export function reminderWindow(now: Date): ReminderWindow {
  return {
    // Borne basse à `now` et non à `now + 23 h` : voir ci-dessus, c'est ce qui
    // rend la tâche rattrapable.
    from: now,
    to: new Date(now.getTime() + REMINDER_LEAD_HOURS * 3_600_000),
  };
}

export type RemindableBooking = {
  status: BookingStatus;
  startsAt: Date;
  /** Un rappel de ce type a déjà été envoyé. */
  reminded: boolean;
};

/**
 * Même règle que la requête SQL, sous forme lisible et testable. Sert de
 * filet : la requête sélectionne, ceci décide.
 */
export function shouldRemind(booking: RemindableBooking, now: Date): boolean {
  if (booking.status !== REMINDABLE_STATUS) return false;
  if (booking.reminded) return false;

  const { from, to } = reminderWindow(now);

  // Intervalle ouvert-fermé `(from, to]`, cohérent avec le reste du domaine :
  // un cours déjà commencé n'a plus besoin d'être annoncé.
  return (
    booking.startsAt.getTime() > from.getTime() &&
    booking.startsAt.getTime() <= to.getTime()
  );
}
