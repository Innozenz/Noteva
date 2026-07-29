import { NextResponse } from "next/server";
import { z } from "zod";

import { computeAvailableSlots } from "@/lib/availability";
import { overlapConflict } from "@/lib/bookings/overlap";
import { notifyInBackground } from "@/lib/notifications/send";
import { buildNotification } from "@/lib/notifications/templates";
import prisma from "@/lib/prisma";
import { requireTeacher } from "@/lib/teacher/session";

/**
 * Reprogrammation d'un cours par le prof (glisser-déposer dans l'agenda).
 *
 * Le prof déplace **son** cours : `requireTeacher`, et on vérifie que la
 * réservation lui appartient (404 sinon, comme partout — on ne confirme pas
 * l'existence d'un identifiant à un tiers).
 *
 * Choix produit (V1) : seuls les cours **confirmés** se déplacent, la durée est
 * conservée (déplacement, pas redimensionnement), le cours **reste confirmé** et
 * l'élève est prévenu. Deux gardes, comme à la création :
 *
 * 1. Revalidation des disponibilités — le nouvel horaire doit tomber dans un
 *    créneau réellement ouvert, aimanté au pas du prof, sans chevauchement. Le
 *    préavis minimum et l'horizon sont relâchés : ce sont des contraintes de
 *    réservation côté élève, elles n'ont pas à empêcher un prof de décaler un
 *    cours de demain. Le plancher `now` reste — on ne déplace pas vers le passé.
 * 2. La contrainte d'exclusion en base tranche la course que la revalidation ne
 *    voit pas ; son rejet devient un 409.
 */

const MINUTE_MS = 60_000;
const BLOCKING_STATUSES = ["PENDING", "CONFIRMED"] as const;

const bodySchema = z.object({ startsAt: z.coerce.date() });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const teacher = await requireTeacher();
    if (!teacher.ok) {
      return NextResponse.json({ error: teacher.error }, { status: teacher.status });
    }

    const { id } = await params;
    const parsed = bodySchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Paramètres invalides", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      select: {
        teacherId: true,
        status: true,
        startsAt: true,
        endsAt: true,
        instrument: { select: { name: true } },
        teacher: {
          select: {
            slotGranularityMin: true,
            bufferMin: true,
            user: { select: { name: true, email: true, timezone: true } },
          },
        },
        student: { select: { user: { select: { name: true, email: true } } } },
      },
    });

    // 404 et non 403 pour un cours qui n'est pas le sien : ne pas révéler qu'un
    // identifiant existe.
    if (!booking || booking.teacherId !== teacher.teacherId) {
      return NextResponse.json({ error: "Cours introuvable" }, { status: 404 });
    }

    if (booking.status !== "CONFIRMED") {
      return NextResponse.json(
        { error: "Seul un cours confirmé peut être déplacé" },
        { status: 409 }
      );
    }

    const durationMin = Math.round(
      (booking.endsAt.getTime() - booking.startsAt.getTime()) / MINUTE_MS
    );
    const startsAt = parsed.data.startsAt;
    const endsAt = new Date(startsAt.getTime() + durationMin * MINUTE_MS);

    // --- Revalidation : le nouvel horaire tombe-t-il dans une disponibilité ?
    const [rules, exceptions, busy] = await Promise.all([
      prisma.availabilityRule.findMany({
        where: { teacherId: teacher.teacherId },
        select: {
          weekday: true,
          startMinute: true,
          endMinute: true,
          validFrom: true,
          validUntil: true,
        },
      }),
      prisma.availabilityException.findMany({
        where: {
          teacherId: teacher.teacherId,
          date: {
            gte: new Date(startsAt.getTime() - 86_400_000),
            lte: new Date(endsAt.getTime() + 86_400_000),
          },
        },
        select: { date: true, type: true, startMinute: true, endMinute: true },
      }),
      // Le cours déplacé est exclu du « busy » : sans quoi il se bloquerait
      // lui-même sur son ancienne position, à un battement près.
      prisma.booking.findMany({
        where: {
          teacherId: teacher.teacherId,
          id: { not: id },
          status: { in: [...BLOCKING_STATUSES] },
          startsAt: {
            lt: new Date(endsAt.getTime() + booking.teacher.bufferMin * MINUTE_MS),
          },
          endsAt: {
            gt: new Date(startsAt.getTime() - booking.teacher.bufferMin * MINUTE_MS),
          },
        },
        select: { startsAt: true, endsAt: true },
      }),
    ]);

    const slots = computeAvailableSlots({
      timezone: booking.teacher.user.timezone,
      rules,
      exceptions,
      busy,
      range: { from: startsAt, to: endsAt },
      slotDurationMin: durationMin,
      granularityMin: booking.teacher.slotGranularityMin,
      bufferMin: booking.teacher.bufferMin,
      // Relâchés pour un prof : voir l'en-tête. Le plancher reste `now`.
      minNoticeHours: 0,
      bookingHorizonDays: 3650,
      now: new Date(),
    });

    const matches = slots.some(
      (slot) => slot.startsAt.getTime() === startsAt.getTime()
    );

    if (!matches) {
      return NextResponse.json(
        { error: "Ce créneau n'est pas ouvert à la réservation" },
        { status: 409 }
      );
    }

    try {
      // Conditionnel sur le statut : une confirmation/annulation concurrente
      // fait perdre le déplacement (count 0 → 409), la base restant l'arbitre
      // du chevauchement.
      const result = await prisma.booking.updateMany({
        where: { id, teacherId: teacher.teacherId, status: "CONFIRMED" },
        data: { startsAt, endsAt },
      });

      if (result.count === 0) {
        return NextResponse.json(
          { error: "Ce cours n'est plus déplaçable" },
          { status: 409 }
        );
      }
    } catch (error) {
      const conflict = overlapConflict(error);
      if (conflict) {
        return NextResponse.json({ error: conflict }, { status: 409 });
      }
      throw error;
    }

    // L'élève doit apprendre que son cours a changé d'heure ; non attendu, comme
    // les autres notifications de réservation.
    notifyInBackground(
      buildNotification(
        "booking_rescheduled",
        {
          teacherName: booking.teacher.user.name,
          teacherEmail: booking.teacher.user.email,
          studentName: booking.student.user.name,
          studentEmail: booking.student.user.email,
          instrumentName: booking.instrument.name,
          startsAt,
          previousStartsAt: booking.startsAt,
          timezone: booking.teacher.user.timezone,
          isTrial: false,
          appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
        },
        "teacher"
      )
    );

    return NextResponse.json({
      id,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    });
  } catch (error) {
    console.error("[BOOKING_RESCHEDULE_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
