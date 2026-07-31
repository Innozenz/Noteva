import { NextResponse } from "next/server";

import { resolveParticipant } from "@/lib/bookings/participant";
import { createThreadMessage } from "@/lib/messages/create";
import { notifyThreadMessage } from "@/lib/messages/notify";
import prisma from "@/lib/prisma";

/**
 * Commentaire sous un compte rendu.
 *
 * Les deux parties peuvent commenter — c'est un échange contextuel, attaché au
 * compte rendu d'un cours. Un commentaire n'existe que si le compte rendu
 * existe (le prof l'a rédigé) ; sinon 404. L'autre partie est prévenue. Le corps
 * est en `multipart/form-data` : `content` (texte) et/ou `file` (pièce jointe).
 */
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

    const form = await request.formData();
    const file = form.get("file");
    const result = await createThreadMessage({
      teacherId: booking.teacherId,
      studentId: booking.studentId,
      sender: access.actor === "teacher" ? "TEACHER" : "STUDENT",
      reportId: booking.report.id,
      content: typeof form.get("content") === "string" ? (form.get("content") as string) : "",
      file: file instanceof File ? file : null,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    await notifyThreadMessage({
      teacherId: booking.teacherId,
      studentId: booking.studentId,
      actor: access.actor,
    });

    return NextResponse.json(result.message);
  } catch (error) {
    console.error("[REPORT_COMMENT_POST_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
