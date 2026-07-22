import { NextResponse } from "next/server";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { requireTeacher } from "@/lib/teacher/session";

/**
 * Exceptions ponctuelles : congés (`BLOCKED`) et ouvertures hors grille
 * (`EXTRA`).
 *
 * La date est une date civile. Prisma stocke les colonnes `@db.Date` à minuit
 * UTC et le moteur de créneaux les relit en UTC : la valeur reçue doit donc
 * être une date nue « AAAA-MM-JJ », jamais un instant, sinon un prof à l'ouest
 * de Greenwich poserait son congé la veille.
 */

const createSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Attendu : AAAA-MM-JJ"),
    type: z.enum(["BLOCKED", "EXTRA"]),
    startMinute: z.number().int().min(0).max(1440).nullable().optional(),
    endMinute: z.number().int().min(0).max(1440).nullable().optional(),
    reason: z.string().max(200).optional(),
  })
  .refine(
    (e) =>
      (e.startMinute == null && e.endMinute == null) ||
      (e.startMinute != null && e.endMinute != null),
    { message: "Renseignez les deux bornes horaires, ou aucune" }
  )
  .refine((e) => e.startMinute == null || e.startMinute < e.endMinute!, {
    message: "L'heure de fin doit suivre l'heure de début",
  })
  // Bloquer une journée entière a du sens ; l'ouvrir sans bornes n'en a pas.
  .refine((e) => e.type !== "EXTRA" || e.startMinute != null, {
    message: "Une ouverture exceptionnelle doit porter des horaires",
  });

export async function POST(request: Request) {
  try {
    const teacher = await requireTeacher();

    if (!teacher.ok) {
      return NextResponse.json(
        { error: teacher.error },
        { status: teacher.status }
      );
    }

    const parsed = createSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Paramètres invalides", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { date, type, startMinute, endMinute, reason } = parsed.data;

    const exception = await prisma.availabilityException.create({
      data: {
        teacherId: teacher.teacherId,
        date: new Date(`${date}T00:00:00Z`),
        type,
        startMinute: startMinute ?? null,
        endMinute: endMinute ?? null,
        reason,
      },
      select: {
        id: true,
        date: true,
        type: true,
        startMinute: true,
        endMinute: true,
        reason: true,
      },
    });

    return NextResponse.json(exception, { status: 201 });
  } catch (error) {
    console.error("[TEACHER_EXCEPTION_CREATE_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const teacher = await requireTeacher();

    if (!teacher.ok) {
      return NextResponse.json(
        { error: teacher.error },
        { status: teacher.status }
      );
    }

    const id = new URL(request.url).searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id requis" }, { status: 400 });
    }

    // Le teacherId dans le filtre est ce qui empêche de supprimer l'exception
    // d'un autre prof : un id seul ne suffit pas.
    const deleted = await prisma.availabilityException.deleteMany({
      where: { id, teacherId: teacher.teacherId },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: "Exception introuvable" }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[TEACHER_EXCEPTION_DELETE_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
