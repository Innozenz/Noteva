import type { BookingStatus } from "@prisma/client";

/**
 * Machine à états des réservations.
 *
 * Déclarée à part du handler pour que les règles soient lisibles d'un coup
 * d'œil et testables sans HTTP ni base.
 *
 * `PENDING` et `CONFIRMED` immobilisent un créneau (cf.
 * booking_teacher_no_overlap) ; tous les autres états le libèrent. C'est
 * pourquoi refuser et annuler comptent autant que confirmer : sans eux, une
 * demande jamais traitée bloquerait le planning indéfiniment.
 */

export type BookingAction =
  | "confirm"
  | "decline"
  | "cancel"
  | "complete"
  | "no_show";

/** Qui a le droit de déclencher l'action. */
export type Actor = "teacher" | "student";

/** Contrainte temporelle relative au cours lui-même. */
export type TimeRule = "none" | "after_start" | "after_end";

export type TransitionRule = {
  from: BookingStatus[];
  to: BookingStatus;
  actors: Actor[];
  timing: TimeRule;
};

export const TRANSITIONS: Record<BookingAction, TransitionRule> = {
  confirm: {
    from: ["PENDING"],
    to: "CONFIRMED",
    actors: ["teacher"],
    timing: "none",
  },
  decline: {
    from: ["PENDING"],
    to: "DECLINED",
    actors: ["teacher"],
    timing: "none",
  },
  // Les deux parties peuvent annuler, avant comme après confirmation.
  cancel: {
    from: ["PENDING", "CONFIRMED"],
    to: "CANCELLED",
    actors: ["teacher", "student"],
    timing: "none",
  },
  // Marquer un cours fait avant qu'il ait eu lieu n'a pas de sens : c'est le
  // fondement des avis, qui exigent un booking COMPLETED.
  complete: {
    from: ["CONFIRMED"],
    to: "COMPLETED",
    actors: ["teacher"],
    timing: "after_end",
  },
  no_show: {
    from: ["CONFIRMED"],
    to: "NO_SHOW",
    actors: ["teacher"],
    timing: "after_start",
  },
};

/** États terminaux : plus aucune transition n'en part. */
export const TERMINAL_STATUSES: BookingStatus[] = [
  "CANCELLED",
  "DECLINED",
  "COMPLETED",
  "NO_SHOW",
];

export type TransitionCheck =
  | { ok: true; rule: TransitionRule }
  | { ok: false; status: number; error: string };

/**
 * Vérifie qu'une action est permise. Ne touche pas la base : l'appelant
 * applique ensuite la transition de façon conditionnelle, pour que deux
 * requêtes simultanées ne l'appliquent pas deux fois.
 */
export function checkTransition(input: {
  action: BookingAction;
  currentStatus: BookingStatus;
  actor: Actor;
  startsAt: Date;
  endsAt: Date;
  now: Date;
}): TransitionCheck {
  const rule = TRANSITIONS[input.action];

  if (!rule.actors.includes(input.actor)) {
    return {
      ok: false,
      status: 403,
      error:
        input.actor === "student"
          ? "Seul le prof peut effectuer cette action"
          : "Seul l'élève peut effectuer cette action",
    };
  }

  if (!rule.from.includes(input.currentStatus)) {
    return {
      ok: false,
      status: 409,
      error: TERMINAL_STATUSES.includes(input.currentStatus)
        ? `Ce cours est déjà ${frenchStatus(input.currentStatus)}`
        : `Action impossible depuis l'état ${input.currentStatus}`,
    };
  }

  if (rule.timing === "after_end" && input.now < input.endsAt) {
    return {
      ok: false,
      status: 409,
      error: "Le cours n'est pas encore terminé",
    };
  }

  if (rule.timing === "after_start" && input.now < input.startsAt) {
    return {
      ok: false,
      status: 409,
      error: "Le cours n'a pas encore commencé",
    };
  }

  return { ok: true, rule };
}

function frenchStatus(status: BookingStatus): string {
  switch (status) {
    case "CANCELLED":
      return "annulé";
    case "DECLINED":
      return "refusé";
    case "COMPLETED":
      return "terminé";
    case "NO_SHOW":
      return "marqué comme non honoré";
    default:
      return status;
  }
}

/**
 * Une annulation est tardive si elle intervient dans la fenêtre de préavis du
 * prof. Sans paiement en ligne il n'y a aucune pénalité à appliquer : c'est
 * une information rendue à l'appelant, pas un blocage.
 */
export function isLateCancellation(input: {
  startsAt: Date;
  now: Date;
  cancellationWindowHours: number;
}): boolean {
  const deadline =
    input.startsAt.getTime() - input.cancellationWindowHours * 3_600_000;
  return input.now.getTime() > deadline;
}
