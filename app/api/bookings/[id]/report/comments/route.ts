import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveParticipant } from "@/lib/bookings/participant";
import { notifyThreadMessage } from "@/lib/messages/notify";
import prisma from "@/lib/prisma";

/**
 * Commentaire sous un compte rendu.
 *
 * Les deux parties peuvent commenter — c'est un échange contextuel, attaché au
 * compte rendu d'un cours. Un commentaire n'existe que si le compte rendu
 * existe (le prof l'a rédigé) ; sinon 404. L'autre partie est prévenue.
 */
const schema = z.object({ content: z.string().min(1).max(3000) });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await resolveParticipant((await params).id);

    if ("error" in access) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status }
      );
    }

    const parsed = schema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Message vide ou trop long." },
        { status: 400 }
      );
    }

    const booking = await prisma.booking.findUnique({
      where: { id: access.booking.id },
      select: {
        teacherId: true,
        studentId: true,
        report: { select: { id: true } },
      },
    });

    if (!booking?.report) {
      return NextResponse.json(
        { error: "Aucun compte rendu à commenter." },
        { status: 404 }
      );
    }

    const message = await prisma.message.create({
      data: {
        teacherId: booking.teacherId,
        studentId: booking.studentId,
        sender: access.actor === "teacher" ? "TEACHER" : "STUDENT",
        content: parsed.data.content.trim(),
        reportId: booking.report.id,
      },
      select: { id: true, sender: true, content: true, createdAt: true },
    });

    await notifyThreadMessage({
      teacherId: booking.teacherId,
      studentId: booking.studentId,
      actor: access.actor,
    });

    return NextResponse.json(message);
  } catch (error) {
    console.error("[REPORT_COMMENT_POST_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
