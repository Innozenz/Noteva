import { NextResponse } from "next/server";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { requireTeacher } from "@/lib/teacher/session";
import { normalizeWeeklyGrid } from "@/lib/teacher/weekly-grid";

/**
 * Grille hebdomadaire de disponibilités.
 *
 * `PUT` remplace la grille entière plutôt que d'exposer un CRUD par plage :
 * l'éditeur manipule une semaine comme un tout, et un remplacement atomique
 * évite les états intermédiaires incohérents entre deux requêtes.
 *
 * Rappel : ces minutes sont de l'heure locale du prof, pas de l'UTC. C'est ce
 * qui fait qu'une plage « lundi 9h » reste à 9h après le changement d'heure.
 */

const gridSchema = z.object({
  slots: z
    .array(
      z.object({
        weekday: z.number().int().min(1).max(7),
        startMinute: z.number().int().min(0).max(1440),
        endMinute: z.number().int().min(0).max(1440),
      })
    )
    .max(100),
});

export async function GET() {
  try {
    const teacher = await requireTeacher();

    if (!teacher.ok) {
      return NextResponse.json(
        { error: teacher.error },
        { status: teacher.status }
      );
    }

    const [slots, exceptions, timezone] = await Promise.all([
      prisma.availabilityRule.findMany({
        where: { teacherId: teacher.teacherId },
        select: { weekday: true, startMinute: true, endMinute: true },
        orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
      }),
      prisma.availabilityException.findMany({
        where: { teacherId: teacher.teacherId, date: { gte: startOfToday() } },
        select: {
          id: true,
          date: true,
          type: true,
          startMinute: true,
          endMinute: true,
          reason: true,
        },
        orderBy: { date: "asc" },
      }),
      prisma.user
        .findUniqueOrThrow({
          where: { id: teacher.userId },
          select: { timezone: true },
        })
        .then((u) => u.timezone),
    ]);

    return NextResponse.json({ timezone, slots, exceptions });
  } catch (error) {
    console.error("[TEACHER_AVAILABILITY_GET_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const teacher = await requireTeacher();

    if (!teacher.ok) {
      return NextResponse.json(
        { error: teacher.error },
        { status: teacher.status }
      );
    }

    const parsed = gridSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Paramètres invalides", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    // Fusionne les plages qui se recouvrent plutôt que de refuser la saisie :
    // « 9h-12h » puis « 11h-14h » exprime une intention parfaitement claire.
    const grid = normalizeWeeklyGrid(parsed.data.slots);

    if (!grid.ok) {
      return NextResponse.json(
        { error: "Grille invalide", issues: grid.errors },
        { status: 400 }
      );
    }

    await prisma.$transaction([
      prisma.availabilityRule.deleteMany({
        where: { teacherId: teacher.teacherId },
      }),
      prisma.availabilityRule.createMany({
        data: grid.slots.map((slot) => ({
          teacherId: teacher.teacherId,
          weekday: slot.weekday,
          startMinute: slot.startMinute,
          endMinute: slot.endMinute,
        })),
      }),
    ]);

    return NextResponse.json({ slots: grid.slots });
  } catch (error) {
    console.error("[TEACHER_AVAILABILITY_PUT_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
}
