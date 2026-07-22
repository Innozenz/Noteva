import { NextResponse } from "next/server";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { checkPublishable } from "@/lib/teacher/publishable";
import { requireTeacher } from "@/lib/teacher/session";
import { isSubscriptionActive } from "@/lib/teacher/visibility";

/**
 * Fiche du prof connecté.
 *
 * Toujours « ma » fiche : aucun identifiant n'est accepté en paramètre, donc
 * aucune fiche d'autrui n'est atteignable.
 */

const profileSchema = z.object({
  headline: z.string().max(120).nullable().optional(),
  bio: z.string().max(5000).nullable().optional(),
  videoUrl: z.string().url().max(500).nullable().optional(),

  teachesOnline: z.boolean().optional(),
  teachesInPerson: z.boolean().optional(),
  teachesAtHome: z.boolean().optional(),
  city: z.string().max(120).nullable().optional(),
  postalCode: z.string().max(16).nullable().optional(),
  country: z.string().length(2).optional(),
  travelRadiusKm: z.number().int().min(0).max(200).nullable().optional(),
  languages: z.array(z.string().min(2).max(8)).max(10).optional(),

  hourlyRateCents: z.number().int().min(0).max(100_000_00).nullable().optional(),
  trialLessonOffered: z.boolean().optional(),
  trialLessonMinutes: z.number().int().min(10).max(120).nullable().optional(),

  defaultDurationMin: z.number().int().min(15).max(480).optional(),
  bufferMin: z.number().int().min(0).max(120).optional(),
  minNoticeHours: z.number().int().min(0).max(720).optional(),
  bookingHorizonDays: z.number().int().min(1).max(365).optional(),
  cancellationWindowHours: z.number().int().min(0).max(720).optional(),

  /** Remplace l'ensemble des instruments enseignés. */
  instrumentSlugs: z.array(z.string().min(1)).max(20).optional(),
});

const profileSelect = {
  slug: true,
  status: true,
  headline: true,
  bio: true,
  videoUrl: true,
  teachesOnline: true,
  teachesInPerson: true,
  teachesAtHome: true,
  city: true,
  postalCode: true,
  country: true,
  travelRadiusKm: true,
  languages: true,
  hourlyRateCents: true,
  trialLessonOffered: true,
  trialLessonMinutes: true,
  defaultDurationMin: true,
  bufferMin: true,
  minNoticeHours: true,
  bookingHorizonDays: true,
  cancellationWindowHours: true,
  publishedAt: true,
  stripeCurrentPeriodEnd: true,
  instruments: { select: { instrument: { select: { slug: true, name: true } } } },
  _count: { select: { rules: true } },
} as const;

export async function GET() {
  try {
    const teacher = await requireTeacher();

    if (!teacher.ok) {
      return NextResponse.json(
        { error: teacher.error },
        { status: teacher.status }
      );
    }

    return NextResponse.json(await readProfile(teacher.teacherId));
  } catch (error) {
    console.error("[TEACHER_PROFILE_GET_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const teacher = await requireTeacher();

    if (!teacher.ok) {
      return NextResponse.json(
        { error: teacher.error },
        { status: teacher.status }
      );
    }

    const parsed = profileSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Paramètres invalides", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { instrumentSlugs, ...fields } = parsed.data;

    if (instrumentSlugs) {
      const instruments = await prisma.instrument.findMany({
        where: { slug: { in: instrumentSlugs } },
        select: { id: true, slug: true },
      });

      const unknown = instrumentSlugs.filter(
        (slug) => !instruments.some((i) => i.slug === slug)
      );

      if (unknown.length > 0) {
        return NextResponse.json(
          { error: `Instrument inconnu : ${unknown.join(", ")}` },
          { status: 400 }
        );
      }

      // Remplacement complet plutôt que diff : la liste est courte et
      // l'éditeur envoie toujours l'état voulu.
      await prisma.$transaction([
        prisma.teacherInstrument.deleteMany({
          where: { teacherId: teacher.teacherId },
        }),
        prisma.teacherInstrument.createMany({
          data: instruments.map((instrument) => ({
            teacherId: teacher.teacherId,
            instrumentId: instrument.id,
          })),
        }),
      ]);
    }

    if (Object.keys(fields).length > 0) {
      await prisma.teacherProfile.update({
        where: { id: teacher.teacherId },
        data: fields,
      });
    }

    return NextResponse.json(await readProfile(teacher.teacherId));
  } catch (error) {
    console.error("[TEACHER_PROFILE_PATCH_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

/**
 * Rend la fiche accompagnée de son état de publication : le formulaire affiche
 * les manques au fil de la saisie, avec exactement la règle qu'appliquera la
 * route de publication.
 */
async function readProfile(teacherId: string) {
  const profile = await prisma.teacherProfile.findUniqueOrThrow({
    where: { id: teacherId },
    select: profileSelect,
  });

  const { instruments, _count, ...rest } = profile;

  return {
    ...rest,
    instruments: instruments.map((i) => i.instrument),
    availabilityRuleCount: _count.rules,
    publishCheck: checkPublishable({
      headline: profile.headline,
      bio: profile.bio,
      hourlyRateCents: profile.hourlyRateCents,
      teachesOnline: profile.teachesOnline,
      teachesInPerson: profile.teachesInPerson,
      teachesAtHome: profile.teachesAtHome,
      city: profile.city,
      instrumentCount: instruments.length,
      availabilityRuleCount: _count.rules,
    }),
    subscriptionActive: isSubscriptionActive(
      profile.stripeCurrentPeriodEnd,
      new Date()
    ),
  };
}
