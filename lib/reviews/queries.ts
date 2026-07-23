import prisma from "@/lib/prisma";
import {
  EMPTY_SUMMARY,
  summarizeFromCounts,
  type RatingSummary,
} from "./summary";

/**
 * Lecture des avis publiés.
 *
 * `publishedAt: { not: null }` partout : un avis non publié n'entre dans aucun
 * calcul et n'apparaît nulle part. C'est la seule condition à ne jamais
 * oublier ici — un avis en attente qui compterait dans la moyenne rendrait la
 * modération inopérante tout en la laissant paraître active.
 */

const publishedOnly = { publishedAt: { not: null } } as const;

/** Agrégat d'un seul prof, pour sa fiche publique. */
export async function getRatingSummary(
  teacherId: string
): Promise<RatingSummary> {
  const rows = await prisma.review.groupBy({
    by: ["rating"],
    where: { teacherId, ...publishedOnly },
    _count: { _all: true },
  });

  return summarizeFromCounts(
    rows.map((row) => ({ rating: row.rating, count: row._count._all }))
  );
}

/** Répartition 1→5 d'un prof, pour l'histogramme de sa fiche. */
export async function getRatingCounts(teacherId: string) {
  const rows = await prisma.review.groupBy({
    by: ["rating"],
    where: { teacherId, ...publishedOnly },
    _count: { _all: true },
  });

  return rows.map((row) => ({ rating: row.rating, count: row._count._all }));
}

/**
 * Agrégats de plusieurs profs en une requête.
 *
 * Appelé par la recherche : une page de résultats ferait sinon une requête par
 * prof affiché. Les profs sans aucun avis sont absents du `groupBy`, d'où le
 * repli sur `EMPTY_SUMMARY` — c'est le cas le plus fréquent au démarrage, il
 * ne doit pas produire un trou dans l'affichage.
 */
export async function getRatingSummaries(
  teacherIds: string[]
): Promise<Map<string, RatingSummary>> {
  const summaries = new Map<string, RatingSummary>();

  if (teacherIds.length === 0) return summaries;

  const rows = await prisma.review.groupBy({
    by: ["teacherId", "rating"],
    where: { teacherId: { in: teacherIds }, ...publishedOnly },
    _count: { _all: true },
  });

  const byTeacher = new Map<string, { rating: number; count: number }[]>();

  for (const row of rows) {
    const list = byTeacher.get(row.teacherId) ?? [];
    list.push({ rating: row.rating, count: row._count._all });
    byTeacher.set(row.teacherId, list);
  }

  for (const teacherId of teacherIds) {
    const counts = byTeacher.get(teacherId);
    summaries.set(
      teacherId,
      counts ? summarizeFromCounts(counts) : EMPTY_SUMMARY
    );
  }

  return summaries;
}

export type PublicReview = {
  id: string;
  rating: number;
  comment: string | null;
  teacherReply: string | null;
  publishedAt: Date;
  studentName: string | null;
  instrumentName: string;
  lessonAt: Date;
};

/**
 * Avis affichés sur une fiche.
 *
 * Ne rend que le prénom de l'élève : un avis est public, le nom complet de son
 * auteur n'a pas à l'être. Il porte aussi l'instrument et la date du cours,
 * qui sont ce qui rend un avis crédible — « piano, en mai » se vérifie, une
 * étoile seule ne se vérifie pas.
 */
export async function getPublicReviews(
  teacherId: string,
  take = 20
): Promise<PublicReview[]> {
  const rows = await prisma.review.findMany({
    where: { teacherId, ...publishedOnly },
    orderBy: { publishedAt: "desc" },
    take,
    select: {
      id: true,
      rating: true,
      comment: true,
      teacherRepl: true,
      publishedAt: true,
      booking: {
        select: { startsAt: true, instrument: { select: { name: true } } },
      },
      student: { select: { user: { select: { name: true } } } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    teacherReply: row.teacherRepl,
    // `publishedAt` ne peut pas être nul ici : le filtre l'exclut.
    publishedAt: row.publishedAt!,
    studentName: firstName(row.student.user.name),
    instrumentName: row.booking.instrument.name,
    lessonAt: row.booking.startsAt,
  }));
}

/** « Marie Dupont » → « Marie ». Une chaîne vide vaut anonyme. */
function firstName(name: string | null): string | null {
  const first = name?.trim().split(/\s+/)[0];

  return first ? first : null;
}
