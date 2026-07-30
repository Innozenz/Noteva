import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * Résout de quel côté d'un cours se tient l'appelant.
 *
 * Même règle que la route booking : un cours n'est visible que de son prof et
 * de son élève ; pour un tiers on répond **404, pas 403** — confirmer qu'un
 * identifiant existe permettrait de sonder l'agenda des autres.
 *
 * Partagé par les routes de compte rendu, qui appliquent toutes ce contrôle.
 */
export type Participant =
  | {
      actor: "teacher" | "student";
      userId: string;
      booking: {
        id: string;
        status: import("@prisma/client").BookingStatus;
        startsAt: Date;
      };
    }
  | { error: string; status: number };

export async function resolveParticipant(
  bookingId: string
): Promise<Participant> {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return { error: "Non authentifié.", status: 401 };
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      startsAt: true,
      teacher: { select: { userId: true } },
      student: { select: { userId: true } },
    },
  });

  if (!booking) {
    return { error: "Cours introuvable.", status: 404 };
  }

  const actor =
    booking.teacher.userId === session.user.id
      ? "teacher"
      : booking.student.userId === session.user.id
        ? "student"
        : null;

  if (!actor) {
    return { error: "Cours introuvable.", status: 404 };
  }

  return {
    actor,
    userId: session.user.id,
    booking: {
      id: booking.id,
      status: booking.status,
      startsAt: booking.startsAt,
    },
  };
}
