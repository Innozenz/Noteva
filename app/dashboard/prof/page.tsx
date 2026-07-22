import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  TeacherProfileForm,
  type TeacherProfileData,
} from "@/components/teacher-profile-form";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { checkPublishable } from "@/lib/teacher/publishable";
import { isSubscriptionActive } from "@/lib/teacher/visibility";

/**
 * Édition de la fiche prof.
 *
 * Les données initiales sont chargées côté serveur : le formulaire s'affiche
 * rempli dès le premier rendu, sans état de chargement ni requête au montage.
 */
export default async function TeacherProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) redirect("/");

  const profile = await prisma.teacherProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      slug: true,
      status: true,
      headline: true,
      bio: true,
      city: true,
      teachesOnline: true,
      teachesInPerson: true,
      teachesAtHome: true,
      hourlyRateCents: true,
      trialLessonOffered: true,
      trialLessonMinutes: true,
      defaultDurationMin: true,
      bufferMin: true,
      minNoticeHours: true,
      bookingHorizonDays: true,
      cancellationWindowHours: true,
      stripeCurrentPeriodEnd: true,
      instruments: {
        select: { instrument: { select: { slug: true, name: true } } },
      },
      _count: { select: { rules: true } },
    },
  });

  if (!profile) redirect("/dashboard");

  const catalogue = await prisma.instrument.findMany({
    select: { slug: true, name: true },
    orderBy: { name: "asc" },
  });

  const instruments = profile.instruments.map((i) => i.instrument);
  const now = new Date();

  const initial: TeacherProfileData = {
    slug: profile.slug,
    status: profile.status,
    headline: profile.headline,
    bio: profile.bio,
    city: profile.city,
    teachesOnline: profile.teachesOnline,
    teachesInPerson: profile.teachesInPerson,
    teachesAtHome: profile.teachesAtHome,
    hourlyRateCents: profile.hourlyRateCents,
    trialLessonOffered: profile.trialLessonOffered,
    trialLessonMinutes: profile.trialLessonMinutes,
    defaultDurationMin: profile.defaultDurationMin,
    bufferMin: profile.bufferMin,
    minNoticeHours: profile.minNoticeHours,
    bookingHorizonDays: profile.bookingHorizonDays,
    cancellationWindowHours: profile.cancellationWindowHours,
    instruments,
    publishCheck: checkPublishable({
      headline: profile.headline,
      bio: profile.bio,
      hourlyRateCents: profile.hourlyRateCents,
      teachesOnline: profile.teachesOnline,
      teachesInPerson: profile.teachesInPerson,
      teachesAtHome: profile.teachesAtHome,
      city: profile.city,
      instrumentCount: instruments.length,
      availabilityRuleCount: profile._count.rules,
    }),
    subscriptionActive: isSubscriptionActive(
      profile.stripeCurrentPeriodEnd,
      now
    ),
  };

  return <TeacherProfileForm initial={initial} catalogue={catalogue} />;
}
