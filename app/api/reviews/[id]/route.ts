import { NextResponse } from "next/server";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { requireTeacher } from "@/lib/teacher/session";

/**
 * Droit de réponse du prof.
 *
 * Un avis est public et définitif du côté de l'élève ; sans droit de réponse,
 * un malentendu resterait sur la fiche sans contradiction possible. C'est la
 * contrepartie de la publication immédiate.
 *
 * Le prof ne peut ni modifier ni supprimer l'avis — seulement y répondre. Une
 * plateforme où le noté efface la note ne vaut rien pour l'élève qui la lit.
 */

const bodySchema = z.object({
  // Chaîne vide acceptée : c'est ainsi qu'on retire une réponse publiée trop
  // vite, sans avoir besoin d'un DELETE pour un champ.
  reply: z.string().trim().max(2000),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const teacher = await requireTeacher();

    if (!teacher.ok) {
      return NextResponse.json(
        { error: teacher.error },
        { status: teacher.status }
      );
    }

    const parsed = bodySchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Paramètres invalides", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { id } = await params;

    // Mise à jour conditionnée au propriétaire, en une seule requête : un
    // `findUnique` suivi d'un `update` laisserait une fenêtre entre les deux,
    // et surtout distinguerait « inexistant » de « pas à vous ».
    const updated = await prisma.review.updateMany({
      where: { id, teacherId: teacher.teacherId },
      data: { teacherRepl: parsed.data.reply || null },
    });

    // Avis inexistant ou avis d'un autre prof : même réponse. Ne pas les
    // distinguer évite de confirmer l'existence d'un identifiant.
    if (updated.count === 0) {
      return NextResponse.json({ error: "Avis introuvable" }, { status: 404 });
    }

    return NextResponse.json({ id, reply: parsed.data.reply || null });
  } catch (error) {
    console.error("[REVIEW_REPLY_ERROR]", error);
    return NextResponse.json(
      { error: "Impossible d'enregistrer la réponse" },
      { status: 500 }
    );
  }
}
