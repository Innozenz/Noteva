import { NextResponse } from "next/server";

import { resolveParticipant } from "@/lib/bookings/participant";
import prisma from "@/lib/prisma";
import { deletePrivate, presignView } from "@/lib/storage/objects";

/**
 * Une pièce jointe de compte rendu.
 *
 * GET : les deux parties peuvent l'ouvrir — on redirige (302) vers une URL
 * signée à expiration, jamais l'objet en direct (le bucket est privé). DELETE :
 * réservé au prof.
 *
 * L'accès est revérifié à chaque appel, et la pièce doit appartenir au compte
 * rendu de *ce* cours — sinon 404, même forme que « cours introuvable ».
 */
async function loadAttachment(bookingId: string, attachmentId: string) {
  return prisma.reportAttachment.findFirst({
    where: { id: attachmentId, report: { bookingId } },
    select: { id: true, storageKey: true, filename: true },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const { id, attachmentId } = await params;
    const access = await resolveParticipant(id);

    if ("error" in access) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status }
      );
    }

    const attachment = await loadAttachment(id, attachmentId);

    if (!attachment) {
      return NextResponse.json(
        { error: "Pièce jointe introuvable." },
        { status: 404 }
      );
    }

    const url = await presignView({
      key: attachment.storageKey,
      filename: attachment.filename,
    });

    // 302 vers l'URL signée ; brièvement cacheable pour ne pas re-signer à
    // chaque affichage d'une même image, mais bien en deçà de son expiration.
    return new NextResponse(null, {
      status: 302,
      headers: { Location: url, "Cache-Control": "private, max-age=60" },
    });
  } catch (error) {
    console.error("[REPORT_ATTACHMENT_GET_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const { id, attachmentId } = await params;
    const access = await resolveParticipant(id);

    if ("error" in access) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status }
      );
    }

    if (access.actor !== "teacher") {
      return NextResponse.json(
        { error: "Seul le professeur supprime une pièce jointe." },
        { status: 403 }
      );
    }

    const attachment = await loadAttachment(id, attachmentId);

    if (!attachment) {
      return NextResponse.json(
        { error: "Pièce jointe introuvable." },
        { status: 404 }
      );
    }

    try {
      await deletePrivate(attachment.storageKey);
    } catch (error) {
      // L'objet a peut-être déjà disparu : on retire quand même la ligne.
      console.error("[REPORT_ATTACHMENT_DELETE_OBJECT_ERROR]", error);
    }

    await prisma.reportAttachment.delete({ where: { id: attachment.id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[REPORT_ATTACHMENT_DELETE_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
