import { NextResponse } from "next/server";
import { z } from "zod";

import { computeAvailableSlots } from "@/lib/availability";
import prisma from "@/lib/prisma";
import { isTeacherVisible } from "@/lib/teacher/visibility";

/**
 * Créneaux réservables d'un prof.
 *
 * Route publique : la découverte est le cœur d'une marketplace, un élève doit
 * pouvoir consulter un planning avant de créer un compte. Elle n'expose donc
 * que des créneaux — jamais l'identité des élèves ni les notes privées du prof.
 *
 * Les créneaux n'existent nulle part en base : ils sont dérivés à chaque appel
 * par lib/availability. Un créneau rendu ici est un candidat, pas une
 * réservation : c'est la contrainte d'exclusion en base qui tranche en cas de
 * demandes concurrentes.
 */

/** Garde-fou : au-delà, le calcul et la réponse deviennent inutilement lourds. */
const MAX_RANGE_DAYS = 62;
const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

/** Statuts qui immobilisent un créneau, alignés sur booking_teacher_no_overlap. */
const BLOCKING_STATUSES = ["PENDING", "CONFIRMED"] as const;

const querySchema = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
    duration: z.coerce.number().int().min(15).max(480).optional(),
  })
  .refine((q) => q.to > q.from, {
    message: "`to` doit être postérieur à `from`",
  })
  .refine((q) => q.to.getTime() - q.from.getTime() <= MAX_RANGE_DAYS * DAY_MS, {
    message: `La plage ne peut excéder ${MAX_RANGE_DAYS} jours`,
  });

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const url = new URL(request.url);

    const query = querySchema.safeParse({
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
      duration: url.searchParams.get("duration") ?? undefined,
    });

    if (!query.success) {
      return NextResponse.json(
        { error: "Paramètres invalides", issues: query.error.issues },
        { status: 400 }
      );
    }

    const { from, to } = query.data;

    const teacher = await prisma.teacherProfile.findUnique({
      where: { slug },
      select: {
        id: true,
        status: true,
        stripeCurrentPeriodEnd: true,
        defaultDurationMin: true,
        bufferMin: true,
        minNoticeHours: true,
        bookingHorizonDays: true,
        user: { select: { timezone: true } },
      },
    });

    // La visibilité est dérivée, pas stockée : fiche publiée ET abonnement en
    // cours de validité. On répond 404 plutôt que 403 pour ne pas révéler
    // l'existence d'une fiche non publiée.
    if (!teacher || !isTeacherVisible(teacher, new Date())) {
      return NextResponse.json({ error: "Prof introuvable" }, { status: 404 });
    }

    const slotDurationMin = query.data.duration ?? teacher.defaultDurationMin;

    // Le battement élargit les réservations : il faut donc aussi ratisser
    // au-delà de la plage demandée, sinon un cours qui la précède de peu ne
    // mordrait pas sur son premier créneau.
    const busyMargin = teacher.bufferMin * MINUTE_MS + DAY_MS;

    const [rules, exceptions, busy] = await Promise.all([
      prisma.availabilityRule.findMany({
        where: { teacherId: teacher.id },
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
          teacherId: teacher.id,
          date: {
            gte: new Date(from.getTime() - DAY_MS),
            lte: new Date(to.getTime() + DAY_MS),
          },
        },
        select: { date: true, type: true, startMinute: true, endMinute: true },
      }),
      prisma.booking.findMany({
        where: {
          teacherId: teacher.id,
          status: { in: [...BLOCKING_STATUSES] },
          startsAt: { lt: new Date(to.getTime() + busyMargin) },
          endsAt: { gt: new Date(from.getTime() - busyMargin) },
        },
        select: { startsAt: true, endsAt: true },
      }),
    ]);

    const slots = computeAvailableSlots({
      timezone: teacher.user.timezone,
      rules,
      exceptions,
      busy,
      range: { from, to },
      slotDurationMin,
      bufferMin: teacher.bufferMin,
      minNoticeHours: teacher.minNoticeHours,
      bookingHorizonDays: teacher.bookingHorizonDays,
      now: new Date(),
    });

    return NextResponse.json({
      timezone: teacher.user.timezone,
      slotDurationMin,
      slots: slots.map((slot) => ({
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("[TEACHER_AVAILABILITY_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
