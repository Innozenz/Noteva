import { NextResponse } from "next/server";
import { z } from "zod";

import { notifyThreadMessage } from "@/lib/messages/notify";
import prisma from "@/lib/prisma";
import { requireStudent } from "@/lib/student/session";

/**
 * Fil général élève→prof (hors compte rendu).
 *
 * Miroir de la route côté prof : `teacherId` est l'id du profil prof. L'élève
 * n'écrit qu'à un prof avec qui il a au moins un cours — sinon 404.
 */
const schema = z.object({ content: z.string().min(1).max(3000) });

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

    const parsed = schema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Message vide ou trop long." },
        { status: 400 }
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

    const message = await prisma.message.create({
      data: {
        teacherId,
        studentId: student.studentId,
        sender: "STUDENT",
        content: parsed.data.content.trim(),
      },
      select: { id: true, sender: true, content: true, createdAt: true },
    });

    await notifyThreadMessage({
      teacherId,
      studentId: student.studentId,
      actor: "student",
    });

    return NextResponse.json(message);
  } catch (error) {
    console.error("[STUDENT_MESSAGE_POST_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
