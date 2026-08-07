import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/admin/session";
import prisma from "@/lib/prisma";
import { isSubscriptionActive } from "@/lib/teacher/visibility";

/**
 * Accès à la plateforme d'un prof, piloté à la main par un administrateur.
 *
 * La visibilité d'une fiche est **dérivée** de `stripeCurrentPeriodEnd`
 * (`PUBLISHED && date > now`, voir `lib/teacher/visibility.ts`) : agir sur cet
 * accès revient donc à écrire cette seule date. On **n'appelle jamais Stripe**
 * ici — l'admin n'a aucun accès direct à la facturation du prof ; il offre,
 * prolonge ou révoque un accès dans *notre* base, rien de plus.
 *
 * Deux limites assumées, signalées côté écran :
 *
 * - accorder un accès ne rend visible qu'une fiche **publiée** ; sur un
 *   brouillon, la date ne fait rien tant que le prof n'a pas publié ;
 * - si un **vrai** abonnement Stripe existe (`stripeSubscriptionId` présent),
 *   le prochain webhook réécrira cette date. Le geste sert donc avant tout aux
 *   profs **sans** abonnement Stripe (accès offert, partenaire, prolongation).
 *
 * Pas de trace d'audit (qui a accordé quoi) — comme la modération des avis,
 * tolérable tant qu'il n'y a qu'un administrateur, à reprendre au-delà.
 */
const bodySchema = z
  .object({
    action: z.enum(["grant", "revoke"]),
    // Dernier jour d'accès, en date civile AAAA-MM-JJ.
    until: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
  .refine((body) => body.action !== "grant" || body.until !== undefined, {
    message: "Une date de fin est requise pour accorder un accès.",
  });

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
        { error: parsed.error.issues[0]?.message ?? "Paramètres invalides." },
        { status: 400 }
      );
    }

    const { id } = await params;
    const { action, until } = parsed.data;

    const now = new Date();

    // La date de fin couvre tout le jour choisi (fin de journée UTC) : un accès
    // « jusqu'au 12 » vaut encore le 12 au soir.
    let periodEnd: Date | null = null;
    if (action === "grant") {
      periodEnd = new Date(`${until}T23:59:59.999Z`);
      if (Number.isNaN(periodEnd.getTime())) {
        return NextResponse.json({ error: "Date invalide." }, { status: 400 });
      }
      if (periodEnd.getTime() <= now.getTime()) {
        return NextResponse.json(
          { error: "La date de fin doit être dans le futur." },
          { status: 400 }
        );
      }
    }

    // Seuls les profs ont un abonnement. On agit sur « la » fiche de cet
    // utilisateur, jamais sur un identifiant de fiche passé de l'extérieur.
    const profile = await prisma.teacherProfile.findUnique({
      where: { userId: id },
      select: { id: true, status: true, stripeSubscriptionId: true },
    });

    if (!profile) {
      return NextResponse.json(
        { error: "Cet utilisateur n'est pas un professeur." },
        { status: 409 }
      );
    }

    const updated = await prisma.teacherProfile.update({
      where: { id: profile.id },
      data: { stripeCurrentPeriodEnd: periodEnd },
      select: { status: true, stripeCurrentPeriodEnd: true, stripeSubscriptionId: true },
    });

    return NextResponse.json({
      stripeCurrentPeriodEnd: updated.stripeCurrentPeriodEnd,
      active: isSubscriptionActive(updated.stripeCurrentPeriodEnd, now),
      published: updated.status === "PUBLISHED",
      // Vrai abonnement Stripe encore rattaché : le webhook peut réécrire.
      hasStripeSubscription: updated.stripeSubscriptionId !== null,
    });
  } catch (error) {
    console.error("[ADMIN_USER_SUBSCRIPTION_ERROR]", error);
    return NextResponse.json(
      { error: "Impossible de modifier l'accès." },
      { status: 500 }
    );
  }
}