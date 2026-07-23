import type { BookingContext, Notification } from "./templates";

/**
 * Rappels avant cours.
 *
 * À part de `templates.ts` pour une raison de fond : là-bas, toute
 * notification découle d'une action et la règle est « ne jamais prévenir
 * celui qui vient d'agir ». Ici **personne n'a agi** — c'est l'horloge qui
 * déclenche. Il n'y a pas d'acteur à exclure, et les deux parties doivent être
 * prévenues. Faire entrer ce cas dans `buildNotification` obligerait à y
 * introduire un acteur fictif et affaiblirait l'invariant qu'un test vérifie
 * sur tous les autres événements.
 *
 * D'où une signature différente : un rappel produit **deux** messages, pas un.
 */

export type ReminderContext = BookingContext & {
  mode: "ONLINE" | "TEACHER_PLACE" | "STUDENT_PLACE";
  meetingUrl?: string | null;
  address?: string | null;
};

const MODE_LABELS: Record<ReminderContext["mode"], string> = {
  ONLINE: "En visio",
  TEACHER_PLACE: "Chez le prof",
  STUDENT_PLACE: "Chez l'élève",
};

export function buildReminders(context: ReminderContext): Notification[] {
  const when = formatWhen(context.startsAt, context.timezone);
  const student = context.studentName ?? "Un élève";
  const teacher = context.teacherName ?? "votre prof";
  const lesson = context.isTrial
    ? `cours d'essai de ${context.instrumentName}`
    : `cours de ${context.instrumentName}`;

  // Jamais « demain » : un cours confirmé trois heures avant tombe aussi dans
  // la fenêtre, et le mot serait faux. La date et l'heure, elles, sont
  // toujours justes.
  const subject = `Rappel — ${lesson} ${when.short}`;

  const place = [
    `Où : ${MODE_LABELS[context.mode]}`,
    context.mode === "ONLINE" && context.meetingUrl
      ? `Lien : ${context.meetingUrl}`
      : null,
    context.mode !== "ONLINE" && context.address
      ? `Adresse : ${context.address}`
      : null,
  ];

  return [
    {
      to: context.studentEmail,
      subject,
      text: lines([
        `Votre ${lesson} avec ${teacher} approche.`,
        ``,
        `Quand : ${when.long}`,
        ...place,
        ``,
        `Un empêchement ? Prévenez au plus tôt : ${context.appUrl}/dashboard/cours`,
      ]),
    },
    {
      to: context.teacherEmail,
      subject,
      text: lines([
        `Vous avez un ${lesson} avec ${student}.`,
        ``,
        `Quand : ${when.long}`,
        ...place,
        ``,
        `Votre agenda : ${context.appUrl}/dashboard/prof/demandes`,
      ]),
    },
  ];
}

/**
 * Une seule heure pour les deux destinataires, celle du prof — même règle que
 * les autres notifications. Afficher deux heures différentes selon le
 * destinataire est précisément ce qui produit un rendez-vous manqué, et un
 * rappel qui fait manquer un cours serait pire que pas de rappel.
 */
function formatWhen(startsAt: Date, timezone: string) {
  return {
    short: startsAt.toLocaleString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone,
    }),
    long: startsAt.toLocaleString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone,
    }),
  };
}

function lines(parts: (string | null)[]): string {
  return parts.filter((part) => part !== null).join("\n");
}
