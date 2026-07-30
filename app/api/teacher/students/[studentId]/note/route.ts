import { NextResponse } from "next/server";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { requireTeacher } from "@/lib/teacher/session";

/**
 * Note privée du prof sur un élève (fiche élève).
 *
 * Une note par couple prof↔élève, jamais visible de l'élève. Le prof n'y accède
 * que s'il a au moins un cours avec cet élève — sinon 404, comme partout, pour
 * ne pas confirmer l'existence d'un profil qu'il n'a pas à connaître.
 */
const schema = z.object({ content: z.string().max(5000).nullable() });

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const teacher = await requireTeacher();

    if (!teacher.ok) {
      return NextResponse.json(
        { error: teacher.error },
        { status: teacher.status }
      );
    }

    const parsed = schema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Paramètres invalides.", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { studentId } = await params;

    // La note n'existe que dans le cadre d'une relation réelle (un cours).
    const relation = await prisma.booking.findFirst({
      where: { teacherId: teacher.teacherId, studentId },
      select: { id: true },
    });

    if (!relation) {
      return NextResponse.json({ error: "Élève introuvable." }, { status: 404 });
    }

    const content = parsed.data.content?.trim() || null;

    const note = await prisma.teacherStudentNote.upsert({
      where: {
        teacherId_studentId: { teacherId: teacher.teacherId, studentId },
      },
      create: { teacherId: teacher.teacherId, studentId, content },
      update: { content },
      select: { content: true, updatedAt: true },
    });

    return NextResponse.json(note);
  } catch (error) {
    console.error("[STUDENT_NOTE_PUT_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
