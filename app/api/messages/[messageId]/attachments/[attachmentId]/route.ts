import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { presignView } from "@/lib/storage/objects";

/**
 * Une pièce jointe de message (image, partition, note audio).
 *
 * Servie par URL signée à expiration, jamais l'objet privé en direct. L'accès
 * est réservé aux deux parties du fil (le prof et l'élève du message) : pour un
 * tiers, **404** — même forme que « introuvable », pour ne pas confirmer qu'un
 * identifiant existe. La pièce doit appartenir au message de l'URL.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ messageId: string; attachmentId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }

    const { messageId, attachmentId } = await params;

    const attachment = await prisma.messageAttachment.findFirst({
      where: { id: attachmentId, messageId },
      select: {
        storageKey: true,
        filename: true,
        message: {
          select: {
            teacher: { select: { userId: true } },
            student: { select: { userId: true } },
          },
        },
      },
    });

    const isParticipant =
      attachment != null &&
      (attachment.message.teacher.userId === session.user.id ||
        attachment.message.student.userId === session.user.id);

    if (!attachment || !isParticipant) {
      return NextResponse.json(
        { error: "Pièce jointe introuvable." },
        { status: 404 }
      );
    }

    const url = await presignView({
      key: attachment.storageKey,
      filename: attachment.filename,
    });

    return new NextResponse(null, {
      status: 302,
      headers: { Location: url, "Cache-Control": "private, max-age=60" },
    });
  } catch (error) {
    console.error("[MESSAGE_ATTACHMENT_GET_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
