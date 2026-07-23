import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { checkStudentProfile } from "@/lib/student/profile";

/**
 * Profil de l'élève connecté.
 *
 * Toujours « mon » profil : aucun identifiant n'est accepté en paramètre.
 */

const LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "PROFESSIONAL"] as const;

const VOICE_TYPES = [
  "SOPRANO",
  "MEZZO_SOPRANO",
  "ALTO",
  "COUNTERTENOR",
  "TENOR",
  "BARITONE",
  "BASS",
  "UNKNOWN",
] as const;

const bodySchema = z.object({
  // Date civile nue : la colonne est `@db.Date`, un instant décalerait la date
  // d'un jour pour tout fuseau derrière Greenwich — et donc l'âge calculé.
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Attendu : AAAA-MM-JJ")
    .nullable()
    .optional(),
  guardianName: z.string().max(120).nullable().optional(),
  guardianEmail: z.string().email().max(200).nullable().optional().or(z.literal("")),
  guardianPhone: z.string().max(30).nullable().optional(),

  goals: z.string().max(2000).nullable().optional(),
  musicalBackground: z.string().max(2000).nullable().optional(),
  readsSheetMusic: z.boolean().optional(),
  preferredGenres: z.array(z.string().min(1).max(40)).max(10).optional(),
  voiceType: z.enum(VOICE_TYPES).nullable().optional(),

  prefersOnline: z.boolean().optional(),
  city: z.string().max(120).nullable().optional(),
  postalCode: z.string().max(16).nullable().optional(),

  /** Remplace l'ensemble des instruments pratiqués. */
  instruments: z
    .array(
      z.object({
        slug: z.string().min(1),
        level: z.enum(LEVELS).optional(),
        yearsPracticed: z.number().int().min(0).max(90).nullable().optional(),
        ownsInstrument: z.boolean().optional(),
      })
    )
    .max(10)
    .optional(),
});

export async function GET() {
  try {
    const student = await requireStudent();

    if ("error" in student) {
      return NextResponse.json(
        { error: student.error },
        { status: student.status }
      );
    }

    return NextResponse.json(await readProfile(student.id));
  } catch (error) {
    console.error("[STUDENT_PROFILE_GET_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const student = await requireStudent();

    if ("error" in student) {
      return NextResponse.json(
        { error: student.error },
        { status: student.status }
      );
    }

    const parsed = bodySchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Paramètres invalides", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { instruments, birthDate, guardianEmail, ...fields } = parsed.data;

    if (instruments) {
      const known = await prisma.instrument.findMany({
        where: { slug: { in: instruments.map((i) => i.slug) } },
        select: { id: true, slug: true },
      });

      const unknown = instruments
        .map((i) => i.slug)
        .filter((slug) => !known.some((k) => k.slug === slug));

      if (unknown.length > 0) {
        return NextResponse.json(
          { error: `Instrument inconnu : ${unknown.join(", ")}` },
          { status: 400 }
        );
      }

      // Remplacement complet : la liste est courte et le formulaire envoie
      // toujours l'état voulu.
      await prisma.$transaction([
        prisma.studentInstrument.deleteMany({ where: { studentId: student.id } }),
        prisma.studentInstrument.createMany({
          data: instruments.map((entry) => ({
            studentId: student.id,
            instrumentId: known.find((k) => k.slug === entry.slug)!.id,
            level: entry.level ?? "BEGINNER",
            yearsPracticed: entry.yearsPracticed ?? null,
            ownsInstrument: entry.ownsInstrument ?? false,
          })),
        }),
      ]);
    }

    await prisma.studentProfile.update({
      where: { id: student.id },
      data: {
        ...fields,
        ...(birthDate !== undefined
          ? { birthDate: birthDate ? new Date(`${birthDate}T00:00:00Z`) : null }
          : {}),
        ...(guardianEmail !== undefined
          ? { guardianEmail: guardianEmail || null }
          : {}),
      },
    });

    return NextResponse.json(await readProfile(student.id));
  } catch (error) {
    console.error("[STUDENT_PROFILE_PATCH_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

async function requireStudent() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return { error: "Non authentifié", status: 401 } as const;
  }

  const student = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!student) {
    return { error: "Profil élève requis", status: 403 } as const;
  }

  return { id: student.id } as const;
}

/**
 * Rend le profil avec ce qui lui manque, calculé par la même fonction que
 * celle qu'appliquera le formulaire.
 */
async function readProfile(studentId: string) {
  const profile = await prisma.studentProfile.findUniqueOrThrow({
    where: { id: studentId },
    select: {
      birthDate: true,
      guardianName: true,
      guardianEmail: true,
      guardianPhone: true,
      goals: true,
      musicalBackground: true,
      readsSheetMusic: true,
      preferredGenres: true,
      voiceType: true,
      prefersOnline: true,
      city: true,
      postalCode: true,
      instruments: {
        select: {
          level: true,
          yearsPracticed: true,
          ownsInstrument: true,
          instrument: { select: { slug: true, name: true, family: true } },
        },
      },
    },
  });

  return {
    ...profile,
    birthDate: profile.birthDate?.toISOString().slice(0, 10) ?? null,
    instruments: profile.instruments.map((entry) => ({
      slug: entry.instrument.slug,
      name: entry.instrument.name,
      family: entry.instrument.family,
      level: entry.level,
      yearsPracticed: entry.yearsPracticed,
      ownsInstrument: entry.ownsInstrument,
    })),
    issues: checkStudentProfile(profile, new Date()),
  };
}
