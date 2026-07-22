import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { computeAvailableSlots } from "@/lib/availability";
import { notifyInBackground } from "@/lib/notifications/send";
import { buildNotification } from "@/lib/notifications/templates";
import prisma from "@/lib/prisma";
import { isTeacherVisible } from "@/lib/teacher/visibility";

/**
 * Demande de réservation d'un cours.
 *
 * Sans paiement en ligne, rien n'engage l'élève au moment de la demande : le
 * cours naît donc en PENDING et c'est le prof qui confirme. Le créneau est
 * malgré tout immobilisé dès la demande (cf. booking_teacher_no_overlap), sinon
 * un prof recevrait plusieurs demandes concurrentes pour la même heure.
 *
 * Deux protections distinctes, à ne pas confondre :
 *
 * 1. La revalidation des disponibilités ci-dessous. Le client poste un horaire
 *    arbitraire : rien ne l'oblige à avoir consulté la route de disponibilités,
 *    et il pourrait demander 3h du matin un dimanche. On recalcule donc les
 *    créneaux côté serveur et on exige une correspondance exacte.
 * 2. La contrainte d'exclusion en base. La revalidation lit un état qui peut
 *    changer avant l'INSERT — deux demandes simultanées la passent toutes les
 *    deux. Seule la base tranche, et son rejet est traduit ici en 409.
 */

const MINUTE_MS = 60_000;

/** Statuts qui immobilisent un créneau, alignés sur la contrainte d'exclusion. */
const BLOCKING_STATUSES = ["PENDING", "CONFIRMED"] as const;

/** Statuts d'un cours d'essai déjà consommé. */
const HONOURED_STATUSES = ["PENDING", "CONFIRMED", "COMPLETED", "NO_SHOW"] as const;

const listSchema = z.object({
  role: z.enum(["teacher", "student"]).optional(),
  status: z
    .enum([
      "PENDING",
      "CONFIRMED",
      "CANCELLED",
      "COMPLETED",
      "NO_SHOW",
      "DECLINED",
    ])
    .optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

/**
 * Cours de l'utilisateur courant, comme prof et/ou comme élève.
 *
 * Un même compte peut porter les deux profils, d'où le filtre `role`. Sans
 * filtre, on renvoie les deux côtés avec le rôle de l'appelant sur chaque
 * ligne : c'est ce dont le prof a besoin pour repérer ses demandes PENDING,
 * qui immobilisent ses créneaux tant qu'il ne les traite pas.
 */
export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const url = new URL(request.url);
    const parsed = listSchema.safeParse({
      role: url.searchParams.get("role") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Paramètres invalides", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { role, status, from, to } = parsed.data;

    const sides = [];
    if (role !== "student") sides.push({ teacher: { userId: session.user.id } });
    if (role !== "teacher") sides.push({ student: { userId: session.user.id } });

    const bookings = await prisma.booking.findMany({
      where: {
        OR: sides,
        ...(status ? { status } : {}),
        ...(from ? { endsAt: { gt: from } } : {}),
        ...(to ? { startsAt: { lt: to } } : {}),
      },
      orderBy: { startsAt: "asc" },
      take: 200,
      select: {
        id: true,
        status: true,
        startsAt: true,
        endsAt: true,
        mode: true,
        isTrial: true,
        priceCents: true,
        studentMessage: true,
        instrument: { select: { slug: true, name: true } },
        teacher: {
          select: { slug: true, userId: true, user: { select: { name: true } } },
        },
        student: {
          select: { userId: true, user: { select: { name: true } } },
        },
      },
    });

    return NextResponse.json({
      bookings: bookings.map(({ teacher, student, ...booking }) => ({
        ...booking,
        viewerRole:
          teacher.userId === session.user.id ? "teacher" : "student",
        teacher: { slug: teacher.slug, name: teacher.user.name },
        student: { name: student.user.name },
      })),
    });
  } catch (error) {
    console.error("[BOOKING_LIST_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

const bodySchema = z.object({
  teacherSlug: z.string().min(1),
  instrumentSlug: z.string().min(1),
  startsAt: z.coerce.date(),
  durationMin: z.coerce.number().int().min(15).max(480).optional(),
  mode: z.enum(["ONLINE", "TEACHER_PLACE", "STUDENT_PLACE"]).optional(),
  isTrial: z.boolean().optional(),
  studentMessage: z.string().max(2000).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Paramètres invalides", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const body = parsed.data;

    const student = await prisma.studentProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (!student) {
      return NextResponse.json(
        { error: "Un profil élève est requis pour réserver" },
        { status: 403 }
      );
    }

    const teacher = await prisma.teacherProfile.findUnique({
      where: { slug: body.teacherSlug },
      select: {
        id: true,
        userId: true,
        status: true,
        stripeCurrentPeriodEnd: true,
        defaultDurationMin: true,
        bufferMin: true,
        minNoticeHours: true,
        bookingHorizonDays: true,
        hourlyRateCents: true,
        trialLessonOffered: true,
        trialLessonMinutes: true,
        teachesOnline: true,
        teachesInPerson: true,
        teachesAtHome: true,
        user: { select: { timezone: true } },
        instruments: { select: { instrumentId: true } },
      },
    });

    // Même règle de visibilité que la route de disponibilités : on ne réserve
    // pas chez un prof qu'on ne peut pas voir. 404 plutôt que 403 pour ne pas
    // révéler l'existence d'une fiche non publiée.
    if (!teacher || !isTeacherVisible(teacher, new Date())) {
      return NextResponse.json({ error: "Prof introuvable" }, { status: 404 });
    }

    if (teacher.userId === session.user.id) {
      return NextResponse.json(
        { error: "On ne réserve pas un cours chez soi-même" },
        { status: 400 }
      );
    }

    const instrument = await prisma.instrument.findUnique({
      where: { slug: body.instrumentSlug },
      select: { id: true, name: true },
    });

    if (!instrument) {
      return NextResponse.json(
        { error: "Instrument inconnu" },
        { status: 400 }
      );
    }

    if (!teacher.instruments.some((i) => i.instrumentId === instrument.id)) {
      return NextResponse.json(
        { error: `Ce prof n'enseigne pas : ${instrument.name}` },
        { status: 400 }
      );
    }

    const mode = body.mode ?? defaultMode(teacher);

    if (!isModeSupported(teacher, mode)) {
      return NextResponse.json(
        { error: "Ce prof ne propose pas cette modalité de cours" },
        { status: 400 }
      );
    }

    const isTrial = body.isTrial ?? false;

    if (isTrial && !teacher.trialLessonOffered) {
      return NextResponse.json(
        { error: "Ce prof ne propose pas de cours d'essai" },
        { status: 400 }
      );
    }

    // Un seul essai par couple élève/prof, sinon l'offre devient un abonnement
    // gratuit déguisé.
    if (isTrial) {
      const previousTrial = await prisma.booking.findFirst({
        where: {
          teacherId: teacher.id,
          studentId: student.id,
          isTrial: true,
          status: { in: [...HONOURED_STATUSES] },
        },
        select: { id: true },
      });

      if (previousTrial) {
        return NextResponse.json(
          { error: "Le cours d'essai chez ce prof a déjà été utilisé" },
          { status: 409 }
        );
      }
    }

    const durationMin = isTrial
      ? teacher.trialLessonMinutes ?? teacher.defaultDurationMin
      : body.durationMin ?? teacher.defaultDurationMin;

    const startsAt = body.startsAt;
    const endsAt = new Date(startsAt.getTime() + durationMin * MINUTE_MS);

    // --- Revalidation : l'horaire demandé tombe-t-il dans une disponibilité ?
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
            gte: new Date(startsAt.getTime() - 86_400_000),
            lte: new Date(endsAt.getTime() + 86_400_000),
          },
        },
        select: { date: true, type: true, startMinute: true, endMinute: true },
      }),
      prisma.booking.findMany({
        where: {
          teacherId: teacher.id,
          status: { in: [...BLOCKING_STATUSES] },
          startsAt: { lt: new Date(endsAt.getTime() + teacher.bufferMin * MINUTE_MS) },
          endsAt: { gt: new Date(startsAt.getTime() - teacher.bufferMin * MINUTE_MS) },
        },
        select: { startsAt: true, endsAt: true },
      }),
    ]);

    // On demande au moteur les créneaux de la fenêtre exacte du cours voulu :
    // si l'horaire est valide, il en ressort un qui commence précisément là.
    const slots = computeAvailableSlots({
      timezone: teacher.user.timezone,
      rules,
      exceptions,
      busy,
      range: { from: startsAt, to: endsAt },
      slotDurationMin: durationMin,
      bufferMin: teacher.bufferMin,
      minNoticeHours: teacher.minNoticeHours,
      bookingHorizonDays: teacher.bookingHorizonDays,
      now: new Date(),
    });

    const matches = slots.some(
      (slot) => slot.startsAt.getTime() === startsAt.getTime()
    );

    if (!matches) {
      return NextResponse.json(
        { error: "Ce créneau n'est pas disponible à la réservation" },
        { status: 409 }
      );
    }

    const priceCents =
      isTrial || teacher.hourlyRateCents === null
        ? null
        : Math.round((teacher.hourlyRateCents * durationMin) / 60);

    try {
      const booking = await prisma.booking.create({
        data: {
          teacherId: teacher.id,
          studentId: student.id,
          instrumentId: instrument.id,
          startsAt,
          endsAt,
          status: "PENDING",
          mode,
          isTrial,
          priceCents,
          studentMessage: body.studentMessage,
        },
        select: {
          id: true,
          startsAt: true,
          endsAt: true,
          status: true,
          mode: true,
          isTrial: true,
          priceCents: true,
          studentMessage: true,
          teacher: {
            select: { user: { select: { name: true, email: true } } },
          },
          student: {
            select: { user: { select: { name: true, email: true } } },
          },
        },
      });

      // Le prof ne découvrirait sa demande qu'en ouvrant son agenda, alors
      // qu'elle immobilise déjà son créneau. Non attendu : la réponse ne doit
      // pas dépendre de la latence du fournisseur d'e-mail.
      notifyInBackground(
        buildNotification(
          "booking_requested",
          {
            teacherName: booking.teacher.user.name,
            teacherEmail: booking.teacher.user.email,
            studentName: booking.student.user.name,
            studentEmail: booking.student.user.email,
            instrumentName: instrument.name,
            startsAt: booking.startsAt,
            timezone: teacher.user.timezone,
            isTrial: booking.isTrial,
            studentMessage: booking.studentMessage,
            appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
          },
          "student"
        )
      );

      return NextResponse.json(booking, { status: 201 });
    } catch (error) {
      // La base a tranché une course que la revalidation ne pouvait pas voir.
      const conflict = overlapConflict(error);

      if (conflict) {
        return NextResponse.json({ error: conflict }, { status: 409 });
      }

      throw error;
    }
  } catch (error) {
    console.error("[BOOKING_CREATE_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

function defaultMode(teacher: {
  teachesOnline: boolean;
  teachesInPerson: boolean;
}): "ONLINE" | "TEACHER_PLACE" | "STUDENT_PLACE" {
  if (teacher.teachesOnline) return "ONLINE";
  if (teacher.teachesInPerson) return "TEACHER_PLACE";
  return "STUDENT_PLACE";
}

function isModeSupported(
  teacher: {
    teachesOnline: boolean;
    teachesInPerson: boolean;
    teachesAtHome: boolean;
  },
  mode: "ONLINE" | "TEACHER_PLACE" | "STUDENT_PLACE"
): boolean {
  if (mode === "ONLINE") return teacher.teachesOnline;
  if (mode === "TEACHER_PLACE") return teacher.teachesInPerson;
  return teacher.teachesAtHome;
}

/**
 * Traduit une violation de contrainte d'exclusion en message métier.
 *
 * Le driver adapter ne remonte pas le SQLSTATE 23P01 tel quel : le nom de la
 * contrainte, lui, se retrouve dans l'erreur sérialisée. C'est donc sur lui
 * qu'on s'appuie — d'où l'importance de ne pas renommer ces contraintes sans
 * mettre à jour cette fonction.
 */
function overlapConflict(error: unknown): string | null {
  const candidate = error as { meta?: unknown; message?: unknown };
  const blob = `${JSON.stringify(candidate?.meta ?? {})} ${String(candidate?.message ?? "")}`;

  if (blob.includes("booking_teacher_no_overlap")) {
    return "Ce créneau vient d'être pris";
  }

  if (blob.includes("booking_student_no_overlap")) {
    return "Vous avez déjà un cours confirmé sur ce créneau";
  }

  return null;
}
