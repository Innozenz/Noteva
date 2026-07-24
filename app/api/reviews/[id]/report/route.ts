import { NextResponse } from "next/server";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { REPORT_REASON_VALUES } from "@/lib/reviews/report";
import { notifyReportInBackground } from "@/lib/reviews/report-notify";
import { requireTeacher } from "@/lib/teacher/session";

/**
 * Signalement d'un avis par le prof qui l'a reçu.
 *
 * Seul recours du noté, puisqu'il ne peut ni modifier ni supprimer l'avis. Le
 * signalement **ne masque rien** : il remonte l'avis en tête de la file de
 * modération. Laisser le prof retirer lui-même une note qui lui déplaît viderait
 * les avis de leur sens pour l'élève qui les lit.
 *
 * L'autorisation reste triviale, comme sur toutes les routes « ma » ressource :
 * on ne signale que les avis dont on est le destinataire. Un avis inexistant et
 * l'avis d'un autre prof donnent le **même 404** — distinguer les deux
 * confirmerait l'existence d'un identifiant.
 */

const bodySchema = z.object({
  reason: z.enum(REPORT_REASON_VALUES),
  detail: z.string().trim().max(1000).optional(),
});

export async function POST(
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
        { error: "Motif de signalement invalide" },
        { status: 400 }
      );
    }

    const { id } = await params;

    // Filtré sur le prof de la session : aucune fiche d'autrui n'est
    // atteignable, et « pas à vous » se confond avec « n'existe pas ».
    const review = await prisma.review.findFirst({
      where: { id, teacherId: teacher.teacherId },
      select: {
        id: true,
        rating: true,
        comment: true,
        teacher: { select: { user: { select: { name: true } } } },
        booking: { select: { instrument: { select: { name: true } } } },
      },
    });

    if (!review) {
      return NextResponse.json({ error: "Avis introuvable" }, { status: 404 });
    }

    const report = await prisma.reviewReport.create({
      data: {
        reviewId: review.id,
        teacherId: teacher.teacherId,
        reason: parsed.data.reason,
        detail: parsed.data.detail || null,
      },
      select: { id: true, reason: true, createdAt: true },
    });

    // Sans cet e-mail, un signalement n'existe que pour qui pense à ouvrir la
    // file : c'est la même raison qui fait notifier le prof d'un avis reçu.
    notifyReportInBackground({
      reason: report.reason,
      detail: parsed.data.detail || null,
      teacherName: review.teacher.user.name,
      instrumentName: review.booking.instrument.name,
      rating: review.rating,
      comment: review.comment,
    });

    return NextResponse.json(
      { id: report.id, reason: report.reason },
      { status: 201 }
    );
  } catch (error) {
    // Deux clics simultanés : l'unicité de `reviewId` tranche là où un test
    // applicatif aurait une fenêtre de course, comme pour l'avis lui-même.
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: "Cet avis est déjà signalé" },
        { status: 409 }
      );
    }

    console.error("[REVIEW_REPORT_ERROR]", error);
    return NextResponse.json(
      { error: "Impossible d'enregistrer le signalement" },
      { status: 500 }
    );
  }
}

/**
 * L'adaptateur de pilote n'expose pas de code d'erreur exploitable ; le nom de
 * la contrainte survit à la sérialisation — même raison qu'à `isUniqueViolation`
 * dans /api/reviews et `overlapConflict` dans /api/bookings.
 */
function isUniqueViolation(error: unknown): boolean {
  const text = error instanceof Error ? `${error.message}` : String(error);

  return (
    text.includes("review_report_reviewId_key") ||
    text.includes("Unique constraint")
  );
}
