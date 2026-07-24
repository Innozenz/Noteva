import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/admin/session";
import prisma from "@/lib/prisma";

/**
 * Modération d'un avis.
 *
 * L'action se réduit à publier ou masquer : un modérateur ne réécrit jamais
 * l'avis d'un élève. Corriger les mots de quelqu'un d'autre tout en les
 * laissant signés de son prénom serait pire que de masquer.
 *
 * Le masquage réutilise `publishedAt` — nul signifie invisible, et toutes les
 * lectures publiques filtrent déjà là-dessus (`lib/reviews/queries.ts`). Pas de
 * second état à tenir cohérent, donc pas d'état qui puisse diverger.
 *
 * Les avis naissent publiés : `publishedAt` nul ne peut donc signifier que
 * « masqué par la modération ».
 *
 * **Un signalement se clôt, il ne se supprime pas.** `resolvedAt` daté sort
 * l'avis de la file des décisions attendues sans effacer le fait qu'un prof a
 * signalé : une modération dont on ne peut pas relire les décisions n'est pas
 * une modération. Masquer clôt le signalement au passage — la demande a reçu
 * sa réponse — tandis que `dismissReport` le clôt en laissant l'avis en ligne,
 * ce qui est l'autre réponse possible.
 */

const bodySchema = z
  .object({
    published: z.boolean().optional(),
    dismissReport: z.boolean().optional(),
  })
  .refine(
    (body) => body.published !== undefined || body.dismissReport === true,
    { message: "Aucune action demandée" }
  );

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();

    if (!admin.ok) {
      return NextResponse.json({ error: admin.error }, { status: admin.status });
    }

    const parsed = bodySchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Paramètres invalides" },
        { status: 400 }
      );
    }

    const { id } = await params;
    const { published, dismissReport } = parsed.data;

    const review = await prisma.review.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!review) {
      return NextResponse.json({ error: "Avis introuvable" }, { status: 404 });
    }

    // Masquer répond au signalement ; le rejeter aussi. Dans les deux cas le
    // signalement cesse d'attendre une décision.
    const closesReport = dismissReport === true || published === false;

    const [updated] = await prisma.$transaction([
      published === undefined
        ? prisma.review.findUnique({
            where: { id },
            select: { publishedAt: true },
          })
        : prisma.review.update({
            where: { id },
            data: { publishedAt: published ? new Date() : null },
            select: { publishedAt: true },
          }),
      ...(closesReport
        ? [
            prisma.reviewReport.updateMany({
              where: { reviewId: id, resolvedAt: null },
              data: { resolvedAt: new Date() },
            }),
          ]
        : []),
    ]);

    return NextResponse.json({
      id,
      published: updated?.publishedAt !== null,
      reportResolved: closesReport,
    });
  } catch (error) {
    console.error("[ADMIN_REVIEW_MODERATION_ERROR]", error);
    return NextResponse.json(
      { error: "Impossible d'appliquer la modération" },
      { status: 500 }
    );
  }
}
