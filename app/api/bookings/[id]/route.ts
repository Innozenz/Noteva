import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import {
  checkTransition,
  isLateCancellation,
  type Actor,
  type BookingAction,
} from "@/lib/bookings/transitions";
import prisma from "@/lib/prisma";

/**
 * Lecture et cycle de vie d'une réservation.
 *
 * Les deux parties voient le cours ; les actions permises dépendent du rôle,
 * et la machine à états vit dans lib/bookings/transitions.ts.
 *
 * Une réservation n'est visible que de son prof et de son élève. Pour un tiers
 * on répond 404 et non 403 : confirmer l'existence d'un identifiant permettrait
 * de sonder l'agenda des autres.
 */

/**
 * `action` est facultative : le prof doit pouvoir annoter un cours ou poser un
 * lien de visio sans en changer l'état. Sans ce cas, ces champs ne seraient
 * écrits qu'à la faveur d'une transition et disparaîtraient silencieusement
 * quand celle-ci est refusée.
 */
const patchSchema = z
  .object({
    action: z
      .enum(["confirm", "decline", "cancel", "complete", "no_show"])
      .optional(),
    reason: z.string().max(1000).optional(),
    teacherNote: z.string().max(2000).optional(),
    meetingUrl: z.string().url().max(500).optional(),
  })
  .refine(
    (b) =>
      b.action !== undefined ||
      b.teacherNote !== undefined ||
      b.meetingUrl !== undefined,
    { message: "Rien à modifier" }
  );

/** Champs rendus aux deux parties. `teacherNote` est privé, il est exclu. */
const bookingSelect = {
  id: true,
  status: true,
  startsAt: true,
  endsAt: true,
  mode: true,
  isTrial: true,
  priceCents: true,
  meetingUrl: true,
  address: true,
  studentMessage: true,
  cancellationReason: true,
  confirmedAt: true,
  cancelledAt: true,
  cancelledById: true,
  completedAt: true,
  createdAt: true,
  instrument: { select: { slug: true, name: true } },
  teacher: { select: { slug: true, user: { select: { name: true } } } },
  student: { select: { user: { select: { name: true } } } },
} as const;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await resolveAccess((await params).id);

    if ("error" in access) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status }
      );
    }

    return NextResponse.json({
      ...(await readBooking(access.booking.id, access.actor)),
      viewerRole: access.actor,
    });
  } catch (error) {
    console.error("[BOOKING_GET_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const parsed = patchSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Paramètres invalides", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const access = await resolveAccess((await params).id);

    if ("error" in access) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status }
      );
    }

    const { booking, actor, userId } = access;
    const now = new Date();

    // Champs annexes, réservés au prof.
    const teacherFields =
      actor === "teacher"
        ? {
            ...(parsed.data.teacherNote !== undefined
              ? { teacherNote: parsed.data.teacherNote }
              : {}),
            ...(parsed.data.meetingUrl !== undefined
              ? { meetingUrl: parsed.data.meetingUrl }
              : {}),
          }
        : {};

    if (!parsed.data.action) {
      if (Object.keys(teacherFields).length === 0) {
        return NextResponse.json(
          { error: "Seul le prof peut modifier ces champs" },
          { status: 403 }
        );
      }

      await prisma.booking.update({
        where: { id: booking.id },
        data: teacherFields,
      });

      return NextResponse.json({
        ...(await readBooking(booking.id, actor)),
        viewerRole: actor,
      });
    }

    const action: BookingAction = parsed.data.action;

    const check = checkTransition({
      action,
      currentStatus: booking.status,
      actor,
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
      now,
    });

    if (!check.ok) {
      return NextResponse.json(
        { error: check.error },
        { status: check.status }
      );
    }

    const late =
      action === "cancel" &&
      isLateCancellation({
        startsAt: booking.startsAt,
        now,
        cancellationWindowHours: booking.teacher.cancellationWindowHours,
      });

    // Mise à jour conditionnée au statut lu : deux requêtes simultanées ne
    // peuvent pas appliquer la transition deux fois, la seconde voit count 0.
    const updated = await prisma.booking.updateMany({
      where: { id: booking.id, status: { in: check.rule.from } },
      data: {
        status: check.rule.to,
        ...(action === "confirm" ? { confirmedAt: now } : {}),
        ...(action === "complete" ? { completedAt: now } : {}),
        ...(action === "cancel" || action === "decline"
          ? {
              cancelledAt: now,
              cancelledById: userId,
              cancellationReason: parsed.data.reason,
            }
          : {}),
        ...teacherFields,
      },
    });

    if (updated.count === 0) {
      return NextResponse.json(
        { error: "Ce cours vient de changer d'état" },
        { status: 409 }
      );
    }

    return NextResponse.json({
      ...(await readBooking(booking.id, actor)),
      viewerRole: actor,
      ...(action === "cancel" ? { lateCancellation: late } : {}),
    });
  } catch (error) {
    console.error("[BOOKING_PATCH_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

/** `teacherNote` n'est jamais sélectionné pour l'élève. */
function readBooking(id: string, actor: Actor) {
  return prisma.booking.findUnique({
    where: { id },
    select: {
      ...bookingSelect,
      ...(actor === "teacher" ? { teacherNote: true } : {}),
    },
  });
}

type Access =
  | {
      actor: Actor;
      userId: string;
      booking: {
        id: string;
        status: import("@prisma/client").BookingStatus;
        startsAt: Date;
        endsAt: Date;
        teacher: { cancellationWindowHours: number };
      };
    }
  | { error: string; status: number };

/**
 * Charge la réservation et détermine de quel côté se tient l'appelant.
 * Toute absence de droit se solde par un 404.
 */
async function resolveAccess(id: string): Promise<Access> {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return { error: "Non authentifié", status: 401 };
  }

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      startsAt: true,
      endsAt: true,
      teacher: { select: { userId: true, cancellationWindowHours: true } },
      student: { select: { userId: true } },
    },
  });

  if (!booking) {
    return { error: "Cours introuvable", status: 404 };
  }

  const actor: Actor | null =
    booking.teacher.userId === session.user.id
      ? "teacher"
      : booking.student.userId === session.user.id
        ? "student"
        : null;

  if (!actor) {
    return { error: "Cours introuvable", status: 404 };
  }

  return {
    actor,
    userId: session.user.id,
    booking: {
      id: booking.id,
      status: booking.status,
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
      teacher: { cancellationWindowHours: booking.teacher.cancellationWindowHours },
    },
  };
}
