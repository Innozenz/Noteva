/**
 * Contenu et destinataire des notifications.
 *
 * Toute la logique vit ici, en fonctions pures : qui doit être prévenu, de
 * quoi, et dans quels termes. C'est ce qui permet de la tester sans
 * fournisseur d'e-mail — l'envoi lui-même n'est qu'un adaptateur.
 *
 * Règle constante : on ne prévient jamais celui qui vient d'agir. Il sait ce
 * qu'il a fait, et recevoir un e-mail pour sa propre action donne l'impression
 * d'un système qui parle dans le vide.
 */

export type NotificationEvent =
  | "booking_requested"
  | "booking_confirmed"
  | "booking_declined"
  | "booking_cancelled"
  | "review_received";

export type Actor = "teacher" | "student";

export type BookingContext = {
  teacherName: string | null;
  teacherEmail: string;
  studentName: string | null;
  studentEmail: string;
  instrumentName: string;
  startsAt: Date;
  /** Fuseau du prof : c'est l'heure du cours qui fait foi. */
  timezone: string;
  isTrial: boolean;
  studentMessage?: string | null;
  cancellationReason?: string | null;
  /** Note déposée, pour `review_received`. */
  rating?: number;
  reviewComment?: string | null;
  /** Racine absolue pour construire les liens. */
  appUrl: string;
};

export type Notification = {
  to: string;
  subject: string;
  /** Corps en texte brut : lisible partout, et rien à échapper. */
  text: string;
};

/**
 * Construit la notification d'un événement, ou `null` s'il n'y a personne à
 * prévenir — cas d'une annulation par une partie qui serait aussi la seule
 * concernée.
 */
export function buildNotification(
  event: NotificationEvent,
  context: BookingContext,
  /** Qui a déclenché l'action. Sert à ne pas se notifier soi-même. */
  actor: Actor
): Notification | null {
  const when = formatWhen(context.startsAt, context.timezone);
  const student = context.studentName ?? "Un élève";
  const teacher = context.teacherName ?? "votre prof";

  switch (event) {
    case "booking_requested": {
      // Toujours une action de l'élève : c'est le prof qu'on prévient.
      if (actor !== "student") return null;

      const lesson = context.isTrial
        ? `un cours d'essai de ${context.instrumentName}`
        : `un cours de ${context.instrumentName}`;

      return {
        to: context.teacherEmail,
        subject: `Nouvelle demande de cours — ${when.short}`,
        text: lines([
          `${student} souhaite réserver ${lesson}.`,
          ``,
          `Quand : ${when.long}`,
          context.studentMessage ? `Message : ${context.studentMessage}` : null,
          ``,
          `Ce créneau reste bloqué tant que vous n'avez pas répondu.`,
          `Répondre : ${context.appUrl}/dashboard/prof/demandes`,
        ]),
      };
    }

    case "booking_confirmed": {
      if (actor !== "teacher") return null;

      return {
        to: context.studentEmail,
        subject: `Cours confirmé — ${when.short}`,
        text: lines([
          `${teacher} a confirmé votre cours de ${context.instrumentName}.`,
          ``,
          `Quand : ${when.long}`,
          ``,
          `Détails : ${context.appUrl}/dashboard/cours`,
        ]),
      };
    }

    case "booking_declined": {
      if (actor !== "teacher") return null;

      return {
        to: context.studentEmail,
        subject: `Demande déclinée — ${when.short}`,
        text: lines([
          `${teacher} n'est finalement pas disponible pour votre cours de ${context.instrumentName} du ${when.long}.`,
          context.cancellationReason
            ? `Motif : ${context.cancellationReason}`
            : null,
          ``,
          `Le créneau est de nouveau libre pour d'autres élèves, et vous pouvez chercher un autre prof :`,
          `${context.appUrl}/profs`,
        ]),
      };
    }

    case "booking_cancelled": {
      // Annulable par les deux : on prévient toujours l'autre partie.
      const toStudent = actor === "teacher";

      return {
        to: toStudent ? context.studentEmail : context.teacherEmail,
        subject: `Cours annulé — ${when.short}`,
        text: lines([
          toStudent
            ? `${teacher} a annulé votre cours de ${context.instrumentName}.`
            : `${student} a annulé son cours de ${context.instrumentName}.`,
          ``,
          `Quand : ${when.long}`,
          context.cancellationReason
            ? `Motif : ${context.cancellationReason}`
            : null,
          ``,
          toStudent
            ? `Trouver un autre créneau : ${context.appUrl}/profs`
            : `Le créneau est de nouveau ouvert à la réservation.`,
          toStudent ? null : `Votre agenda : ${context.appUrl}/dashboard/prof/demandes`,
        ]),
      };
    }

    case "review_received": {
      // Toujours déposé par l'élève : c'est le prof qu'on prévient.
      if (actor !== "student") return null;

      const stars = context.rating ? `${context.rating}/5` : "";

      return {
        to: context.teacherEmail,
        subject: `Nouvel avis sur votre profil${stars ? ` — ${stars}` : ""}`,
        text: lines([
          `${student} a laissé un avis sur son cours de ${context.instrumentName} du ${when.long}.`,
          stars ? `` : null,
          stars ? `Note : ${stars}` : null,
          context.reviewComment ? `« ${context.reviewComment} »` : null,
          ``,
          // Le droit de réponse n'a de valeur que si le prof apprend l'avis :
          // sans cet e-mail, il ne le découvrirait qu'en visitant sa page.
          `Vous pouvez y répondre publiquement : ${context.appUrl}/dashboard/prof/avis`,
        ]),
      };
    }
  }
}

/**
 * Date du cours dans le fuseau du prof.
 *
 * L'élève peut être ailleurs, mais un cours a lieu à une heure : celle du prof.
 * Afficher deux heures différentes selon le destinataire serait une source de
 * rendez-vous manqués.
 */
function formatWhen(startsAt: Date, timezone: string) {
  return {
    short: startsAt.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
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

/** Assemble en ignorant les lignes absentes, pour éviter les trous. */
function lines(parts: (string | null)[]): string {
  return parts.filter((part) => part !== null).join("\n");
}
