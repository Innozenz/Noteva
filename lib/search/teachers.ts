import type { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";
import { getRatingSummaries } from "@/lib/reviews/queries";
import { EMPTY_SUMMARY, type RatingSummary } from "@/lib/reviews/summary";
import { visibleTeacherWhere } from "@/lib/teacher/visibility";
import {
  normalizeTerm,
  pageOffset,
  SEARCH_PAGE_SIZE,
  type SearchFilters,
} from "./query";

/**
 * Recherche de profs.
 *
 * Le filtre de visibilité vient de `visibleTeacherWhere` : une recherche qui
 * remonterait des fiches ensuite refusées en 404 serait pire que pas de
 * recherche.
 */

export type SearchResult = {
  slug: string;
  name: string | null;
  image: string | null;
  headline: string | null;
  city: string | null;
  hourlyRateCents: number | null;
  teachesOnline: boolean;
  teachesInPerson: boolean;
  teachesAtHome: boolean;
  trialLessonOffered: boolean;
  instruments: { slug: string; name: string }[];
  rating: RatingSummary;
};

export type SearchResponse = {
  results: SearchResult[];
  total: number;
  /** Instrument reconnu à partir du terme saisi, s'il y en a un. */
  matchedInstrument: { slug: string; name: string } | null;
};

/**
 * Résout un terme libre en instrument : d'abord par slug, puis par nom, puis
 * par alias. C'est ce qui fait que « coaching vocal » ramène le chant.
 */
export async function resolveInstrument(term: string) {
  const normalized = normalizeTerm(term);

  const bySlug = await prisma.instrument.findUnique({
    where: { slug: normalized },
    select: { id: true, slug: true, name: true },
  });

  if (bySlug) return bySlug;

  const candidates = await prisma.instrument.findMany({
    select: { id: true, slug: true, name: true, aliases: true },
  });

  return (
    candidates.find(
      (instrument) =>
        normalizeTerm(instrument.name) === normalized ||
        instrument.aliases.some((alias) => normalizeTerm(alias) === normalized)
    ) ??
    // À défaut d'égalité, une correspondance partielle : « guitare » doit
    // ramener quelque chose même si l'élève ne connaît pas le nom exact.
    candidates.find(
      (instrument) =>
        normalizeTerm(instrument.name).includes(normalized) ||
        instrument.aliases.some((alias) => normalizeTerm(alias).includes(normalized))
    ) ??
    null
  );
}

export async function searchTeachers(
  filters: SearchFilters
): Promise<SearchResponse> {
  const matched = filters.instrument
    ? await resolveInstrument(filters.instrument)
    : null;

  // Terme d'instrument saisi mais introuvable : on rend une liste vide plutôt
  // que d'ignorer le filtre et de noyer l'élève sous des profs hors sujet.
  if (filters.instrument && !matched) {
    return { results: [], total: 0, matchedInstrument: null };
  }

  const where: Prisma.TeacherProfileWhereInput = {
    ...visibleTeacherWhere(new Date()),
    ...(matched
      ? { instruments: { some: { instrumentId: matched.id } } }
      : {}),
    ...(filters.city
      ? { city: { contains: filters.city, mode: "insensitive" } }
      : {}),
    ...(filters.mode === "online" ? { teachesOnline: true } : {}),
    ...(filters.mode === "in_person"
      ? { OR: [{ teachesInPerson: true }, { teachesAtHome: true }] }
      : {}),
    ...(filters.maxRateCents
      ? { hourlyRateCents: { lte: filters.maxRateCents, not: null } }
      : {}),
    ...(filters.trialOnly ? { trialLessonOffered: true } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.teacherProfile.findMany({
      where,
      // Les fiches publiées récemment d'abord : à défaut de signal de qualité,
      // c'est ce qui donne leur chance aux nouveaux inscrits.
      // Les fiches publiées récemment d'abord. Trier par note serait tentant
      // maintenant qu'elle existe, mais un seul avis à 5 passerait devant
      // quarante avis à 4,8 : il faudrait une moyenne bayésienne (tirer chaque
      // prof vers la moyenne du site proportionnellement à son peu d'avis)
      // avant de changer ce classement.
      orderBy: [{ publishedAt: "desc" }],
      skip: pageOffset(filters.page),
      take: SEARCH_PAGE_SIZE,
      select: {
        id: true,
        slug: true,
        headline: true,
        city: true,
        hourlyRateCents: true,
        teachesOnline: true,
        teachesInPerson: true,
        teachesAtHome: true,
        trialLessonOffered: true,
        user: { select: { name: true, image: true } },
        instruments: {
          select: { instrument: { select: { slug: true, name: true } } },
        },
      },
    }),
    prisma.teacherProfile.count({ where }),
  ]);

  // Une seule requête pour toute la page : un agrégat par prof affiché en
  // ferait vingt.
  const ratings = await getRatingSummaries(rows.map((row) => row.id));

  return {
    total,
    matchedInstrument: matched
      ? { slug: matched.slug, name: matched.name }
      : null,
    results: rows.map((row) => ({
      slug: row.slug,
      name: row.user.name,
      image: row.user.image,
      headline: row.headline,
      city: row.city,
      hourlyRateCents: row.hourlyRateCents,
      teachesOnline: row.teachesOnline,
      teachesInPerson: row.teachesInPerson,
      teachesAtHome: row.teachesAtHome,
      trialLessonOffered: row.trialLessonOffered,
      instruments: row.instruments.map((i) => i.instrument),
      rating: ratings.get(row.id) ?? EMPTY_SUMMARY,
    })),
  };
}

/** Instruments réellement enseignés par au moins un prof visible. */
export async function getSearchableInstruments() {
  return prisma.instrument.findMany({
    where: { teachers: { some: { teacher: visibleTeacherWhere(new Date()) } } },
    select: { slug: true, name: true, family: true },
    orderBy: { name: "asc" },
  });
}
