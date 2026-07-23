import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  TeacherReviewReplies,
  type TeacherReviewRow,
} from "@/components/teacher-review-replies";
import { Stars } from "@/components/ui/stars";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getRatingCounts } from "@/lib/reviews/queries";
import { formatAverage, summarizeFromCounts } from "@/lib/reviews/summary";

/**
 * Avis reçus par le prof.
 *
 * Server Component, comme le reste de l'espace prof, et lit « mes » avis via
 * le profil de la session : aucun identifiant de prof n'est accepté en
 * paramètre, donc aucune fiche d'autrui n'est atteignable par erreur.
 */
export default async function TeacherReviewsPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) redirect("/");

  const teacher = await prisma.teacherProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, user: { select: { timezone: true } } },
  });

  if (!teacher) redirect("/dashboard");

  const [reviews, counts] = await Promise.all([
    prisma.review.findMany({
      where: { teacherId: teacher.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        rating: true,
        comment: true,
        teacherRepl: true,
        publishedAt: true,
        createdAt: true,
        booking: {
          select: { startsAt: true, instrument: { select: { name: true } } },
        },
        student: { select: { user: { select: { name: true } } } },
      },
    }),
    getRatingCounts(teacher.id),
  ]);

  const summary = summarizeFromCounts(counts);

  const rows: TeacherReviewRow[] = reviews.map((review) => ({
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    reply: review.teacherRepl,
    // Prénom seul, comme sur la fiche publique : le prof ne voit pas plus que
    // ce que voient ses futurs élèves.
    studentName: review.student.user.name?.trim().split(/\s+/)[0] ?? null,
    instrumentName: review.booking.instrument.name,
    lessonAt: review.booking.startsAt.toISOString(),
    publishedAt: (review.publishedAt ?? review.createdAt).toISOString(),
  }));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Avis</h1>
          <p className="text-sm text-muted">
            Écrits par des élèves ayant suivi un cours que vous avez clôturé.
          </p>
        </div>

        {summary.average !== null ? (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-white px-4 py-2">
            <span className="text-2xl font-semibold">
              {formatAverage(summary.average)}
            </span>
            <div className="flex flex-col">
              <Stars value={summary.average} />
              <span className="text-xs text-subtle">
                {`${summary.count} avis`}
              </span>
            </div>
          </div>
        ) : null}
      </header>

      <TeacherReviewReplies initial={rows} timezone={teacher.user.timezone} />
    </div>
  );
}
