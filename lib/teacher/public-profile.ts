import { cache } from "react";

import prisma from "@/lib/prisma";
import { isTeacherVisible } from "@/lib/teacher/visibility";

/**
 * Chargement d'une fiche prof publique.
 *
 * Enveloppé dans `cache()` : `generateMetadata` et le composant de page ont
 * tous deux besoin de la fiche, et sans mémoïsation la requête partirait deux
 * fois par rendu. React déduplique sur la durée d'une même requête.
 *
 * Rend `null` pour une fiche non visible, ce que l'appelant traduit en 404 —
 * jamais en 403, qui confirmerait l'existence de la fiche.
 */
export const getPublicTeacher = cache(async (slug: string) => {
  const teacher = await prisma.teacherProfile.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      status: true,
      stripeCurrentPeriodEnd: true,
      headline: true,
      bio: true,
      videoUrl: true,
      city: true,
      country: true,
      teachesOnline: true,
      teachesInPerson: true,
      teachesAtHome: true,
      languages: true,
      hourlyRateCents: true,
      trialLessonOffered: true,
      trialLessonMinutes: true,
      defaultDurationMin: true,
      publishedAt: true,
      user: { select: { name: true, image: true, timezone: true } },
      instruments: {
        select: {
          yearsExperience: true,
          levelsTaught: true,
          instrument: { select: { slug: true, name: true, family: true } },
        },
      },
    },
  });

  if (!isTeacherVisible(teacher, new Date())) return null;

  return teacher;
});
