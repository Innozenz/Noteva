import { NextResponse } from "next/server";

import { createThreadMessage } from "@/lib/messages/create";
import { notifyThreadMessage } from "@/lib/messages/notify";
import prisma from "@/lib/prisma";
import { requireTeacher } from "@/lib/teacher/session";

/**
 * Fil général prof→élève (hors compte rendu).
 *
 * `reportId` nul : c'est le fil du couple, pas un commentaire de cours. Le prof
 * n'écrit qu'à un élève avec qui il a au moins un cours — sinon 404. Le corps est
 * en `multipart/form-data` : `content` (texte) et/ou `file` (pièce jointe).
 */
export async function POST(
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

    const { studentId } = await params;

    const relation = await prisma.booking.findFirst({
      where: { teacherId: teacher.teacherId, studentId },
      select: { id: true },
    });

    if (!relation) {
      return NextResponse.json({ error: "Élève introuvable." }, { status: 404 });
    }

    const form = await request.formData();
    const file = form.get("file");
    const result = await createThreadMessage({
      teacherId: teacher.teacherId,
      studentId,
      sender: "TEACHER",
      content: typeof form.get("content") === "string" ? (form.get("content") as string) : "",
      file: file instanceof File ? file : null,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    await notifyThreadMessage({
      teacherId: teacher.teacherId,
      studentId,
      actor: "teacher",
    });

    return NextResponse.json(result.message);
  } catch (error) {
    console.error("[TEACHER_MESSAGE_POST_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
