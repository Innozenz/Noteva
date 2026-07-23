import {
  ReviewModeration,
  type ModerationRow,
} from "@/components/review-moderation";
import prisma from "@/lib/prisma";

/**
 * Modération des avis.
 *
 * Les avis sont **publiés dès leur dépôt**, et cet écran sert à en retirer un,
 * pas à les autoriser. C'est un choix : une file d'attente sur une plateforme
 * tenue par une personne signifierait qu'aucun avis n'apparaît pendant qu'elle
 * dort, et un élève qui écrit dans le vide n'écrit pas deux fois.
 *
 * Basculer vers une modération a priori tient en une ligne — le `publishedAt`
 * posé à la création dans `/api/reviews` — mais suppose de tenir la file, sans
 * quoi la fonctionnalité meurt en silence.
 *
 * Le tri place les avis masqués en tête : ce sont les décisions à réexaminer,
 * et elles seraient sinon noyées sous les avis normaux au fil du temps.
 */
export default async function AdminReviewsPage() {
  const reviews = await prisma.review.findMany({
    orderBy: [{ publishedAt: "asc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      rating: true,
      comment: true,
      teacherRepl: true,
      publishedAt: true,
      createdAt: true,
      booking: { select: { instrument: { select: { name: true } } } },
      student: { select: { user: { select: { name: true } } } },
      teacher: {
        select: { slug: true, user: { select: { name: true } } },
      },
    },
  });

  const rows: ModerationRow[] = reviews.map((review) => ({
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    reply: review.teacherRepl,
    published: review.publishedAt !== null,
    createdAt: review.createdAt.toISOString(),
    // Prénom seul, comme partout ailleurs : modérer ne demande pas d'en savoir
    // plus que ce que voient les élèves.
    studentName: review.student.user.name?.trim().split(/\s+/)[0] ?? null,
    teacherName: review.teacher.user.name,
    teacherSlug: review.teacher.slug,
    instrumentName: review.booking.instrument.name,
  }));

  const hidden = rows.filter((row) => !row.published).length;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">Avis</h1>
        <p className="mt-1 text-sm text-muted">
          {`Les avis sont publiés dès leur dépôt. ${
            hidden > 0
              ? `${hidden} avis actuellement masqué${hidden > 1 ? "s" : ""}.`
              : "Aucun avis masqué."
          }`}
        </p>
      </header>

      <ReviewModeration initial={rows} />
    </div>
  );
}
