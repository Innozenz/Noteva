import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { notifyInBackground } from "@/lib/notifications/send";
import { buildNotification } from "@/lib/notifications/templates";
import prisma from "@/lib/prisma";
import { checkReviewable } from "@/lib/reviews/eligibility";

/**
 * Dépôt d'un avis.
 *
 * Un avis s'accroche à un cours (`Review.bookingId` est unique) et non à un
 * prof : c'est ce qui garantit qu'il émane de quelqu'un qui a réellement pris
 * cours. Une note libre sur une fiche s'achèterait ou se fabriquerait ; celle-ci
 * suppose une réservation confirmée puis clôturée par le prof lui-même.
 *
 * La règle d'admissibilité vit dans lib/reviews/eligibility.ts, partagée avec
 * l'écran de l'élève, qui n'affiche le formulaire que quand cette route
 * l'accepterait.
 */

const bodySchema = z.object({
  bookingId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  // Un avis peut n'être qu'une note : exiger un texte ferait baisser le volume
  // sans gagner en qualité.
  comment: z.string().trim().max(2000).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Paramètres invalides", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { bookingId, rating, comment } = parsed.data;

    const student = await prisma.studentProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (!student) {
      return NextResponse.json(
        { error: "Profil élève requis" },
        { status: 403 }
      );
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        endsAt: true,
        startsAt: true,
        studentId: true,
        teacherId: true,
        isTrial: true,
        instrument: { select: { name: true } },
        review: { select: { id: true } },
        teacher: {
          select: {
            user: { select: { name: true, email: true, timezone: true } },
          },
        },
        student: { select: { user: { select: { name: true, email: true } } } },
      },
    });

    // Cours inexistant et cours d'autrui sont indiscernables, comme sur
    // /api/bookings/[id] : un 403 confirmerait qu'un identifiant existe.
    if (!booking) {
      return NextResponse.json({ error: "Cours introuvable" }, { status: 404 });
    }

    const eligibility = checkReviewable(
      {
        status: booking.status,
        endsAt: booking.endsAt,
        studentId: booking.studentId,
        hasReview: booking.review !== null,
      },
      student.id,
      new Date()
    );

    if (!eligibility.ok) {
      if (eligibility.reason === "not_participant") {
        return NextResponse.json(
          { error: "Cours introuvable" },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: eligibility.message, reason: eligibility.reason },
        { status: 409 }
      );
    }

    const review = await prisma.review.create({
      data: {
        bookingId: booking.id,
        teacherId: booking.teacherId,
        studentId: student.id,
        rating,
        comment: comment || null,
        // Publié d'emblée. `publishedAt` reste le crochet d'une modération à
        // venir, mais tant qu'aucun écran n'existe pour modérer, naître à null
        // signifierait qu'aucun avis n'apparaît jamais — une fonctionnalité
        // morte plutôt que prudente. Le jour où la modération existe, c'est
        // cette ligne qui change, et rien d'autre.
        publishedAt: new Date(),
      },
      select: { id: true, rating: true, comment: true, publishedAt: true },
    });

    notifyInBackground(
      buildNotification(
        "review_received",
        {
          teacherName: booking.teacher.user.name,
          teacherEmail: booking.teacher.user.email,
          studentName: booking.student.user.name,
          studentEmail: booking.student.user.email,
          instrumentName: booking.instrument.name,
          startsAt: booking.startsAt,
          timezone: booking.teacher.user.timezone,
          isTrial: booking.isTrial,
          rating,
          reviewComment: comment || null,
          appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
        },
        "student"
      )
    );

    return NextResponse.json(review, { status: 201 });
  } catch (error) {
    // Deux avis envoyés simultanément sur le même cours : l'unicité de
    // `bookingId` tranche là où la vérification applicative a une fenêtre de
    // course, exactement comme la contrainte d'exclusion sur les réservations.
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: "Vous avez déjà donné votre avis sur ce cours" },
        { status: 409 }
      );
    }

    console.error("[REVIEW_CREATE_ERROR]", error);
    return NextResponse.json(
      { error: "Impossible d'enregistrer l'avis" },
      { status: 500 }
    );
  }
}

/**
 * L'adaptateur de pilote n'expose pas de code d'erreur exploitable ; le nom de
 * la contrainte, lui, survit à la sérialisation — même raison qu'à
 * `overlapConflict()` dans /api/bookings.
 */
function isUniqueViolation(error: unknown): boolean {
  const text = error instanceof Error ? `${error.message}` : String(error);

  return text.includes("review_bookingId_key") || text.includes("Unique constraint");
}
