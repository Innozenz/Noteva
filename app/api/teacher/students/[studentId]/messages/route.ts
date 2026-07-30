import { NextResponse } from "next/server";
import { z } from "zod";

import { notifyThreadMessage } from "@/lib/messages/notify";
import prisma from "@/lib/prisma";
import { requireTeacher } from "@/lib/teacher/session";

/**
 * Fil général prof→élève (hors compte rendu).
 *
 * `reportId` nul : c'est le fil du couple, pas un commentaire de cours. Le prof
 * n'écrit qu'à un élève avec qui il a au moins un cours — sinon 404.
 */
const schema = z.object({ content: z.string().min(1).max(3000) });

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

    const parsed = schema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Message vide ou trop long." },
        { status: 400 }
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

    const message = await prisma.message.create({
      data: {
        teacherId: teacher.teacherId,
        studentId,
        sender: "TEACHER",
        content: parsed.data.content.trim(),
      },
      select: { id: true, sender: true, content: true, createdAt: true },
    });

    await notifyThreadMessage({
      teacherId: teacher.teacherId,
      studentId,
      actor: "teacher",
    });

    return NextResponse.json(message);
  } catch (error) {
    console.error("[TEACHER_MESSAGE_POST_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
