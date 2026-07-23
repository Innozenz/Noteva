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
 */

const bodySchema = z.object({ published: z.boolean() });

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

    const updated = await prisma.review.updateMany({
      where: { id },
      data: { publishedAt: parsed.data.published ? new Date() : null },
    });

    if (updated.count === 0) {
      return NextResponse.json({ error: "Avis introuvable" }, { status: 404 });
    }

    return NextResponse.json({ id, published: parsed.data.published });
  } catch (error) {
    console.error("[ADMIN_REVIEW_MODERATION_ERROR]", error);
    return NextResponse.json(
      { error: "Impossible d'appliquer la modération" },
      { status: 500 }
    );
  }
}
