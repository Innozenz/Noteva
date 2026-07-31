import { NextResponse } from "next/server";

import { createThreadMessage } from "@/lib/messages/create";
import { notifyThreadMessage } from "@/lib/messages/notify";
import prisma from "@/lib/prisma";
import { requireStudent } from "@/lib/student/session";

/**
 * Fil général élève→prof (hors compte rendu).
 *
 * Miroir de la route côté prof : `teacherId` est l'id du profil prof. L'élève
 * n'écrit qu'à un prof avec qui il a au moins un cours — sinon 404. Le corps est
 * en `multipart/form-data` : `content` (texte) et/ou `file` (pièce jointe).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ teacherId: string }> }
) {
  try {
    const student = await requireStudent();

    if (!student.ok) {
      return NextResponse.json(
        { error: student.error },
        { status: student.status }
      );
    }

    const { teacherId } = await params;

    const relation = await prisma.booking.findFirst({
      where: { teacherId, studentId: student.studentId },
      select: { id: true },
    });

    if (!relation) {
      return NextResponse.json({ error: "Professeur introuvable." }, { status: 404 });
    }

    const form = await request.formData();
    const file = form.get("file");
    const result = await createThreadMessage({
      teacherId,
      studentId: student.studentId,
      sender: "STUDENT",
      content: typeof form.get("content") === "string" ? (form.get("content") as string) : "",
      file: file instanceof File ? file : null,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    await notifyThreadMessage({
      teacherId,
      studentId: student.studentId,
      actor: "student",
    });

    return NextResponse.json(result.message);
  } catch (error) {
    console.error("[STUDENT_MESSAGE_POST_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
