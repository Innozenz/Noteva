import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  TeacherBookings,
  type BookingRow,
} from "@/components/teacher-bookings";
import {
  TeacherVisibilityNotice,
  visibilityBlocker,
} from "@/components/teacher-visibility-notice";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { guardianSummary } from "@/lib/student/profile";
import { checkPublishable } from "@/lib/teacher/publishable";
import { isSubscriptionActive } from "@/lib/teacher/visibility";

/**
 * Boîte de réception du prof.
 *
 * Chargée côté serveur : le prof arrive sur ses demandes affichées, sans état
 * de chargement. Les actions passent ensuite par PATCH /api/bookings/[id], qui
 * porte la machine à états — cet écran n'en réimplémente aucune règle.
 */
export default async function TeacherBookingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) redirect("/");

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: {
      timezone: true,
      teacherProfile: {
        select: {
          id: true,
          status: true,
          headline: true,
          bio: true,
          hourlyRateCents: true,
          teachesOnline: true,
          teachesInPerson: true,
          teachesAtHome: true,
          city: true,
          stripeCurrentPeriodEnd: true,
          _count: { select: { instruments: true, rules: true } },
        },
      },
    },
  });

  if (!user.teacherProfile) redirect("/dashboard");

  const bookings = await prisma.booking.findMany({
    where: { teacherId: user.teacherProfile.id },
    orderBy: { startsAt: "desc" },
    take: 200,
    select: {
      id: true,
      status: true,
      startsAt: true,
      endsAt: true,
      mode: true,
      isTrial: true,
      priceCents: true,
      studentMessage: true,
      instrument: { select: { id: true, name: true } },
      student: {
        select: {
          user: { select: { name: true } },
          // Ce qui aide le prof à décider : niveau réel sur l'instrument
          // demandé, projet de l'élève, et contact du responsable s'il est
          // mineur.
          birthDate: true,
          guardianName: true,
          guardianEmail: true,
          guardianPhone: true,
          goals: true,
          readsSheetMusic: true,
          instruments: {
            select: {
              instrumentId: true,
              level: true,
              yearsPracticed: true,
              ownsInstrument: true,
            },
          },
        },
      },
    },
  });

  const now = new Date();

  const rows: BookingRow[] = bookings.map((booking) => {
    const student = booking.student;
    // Niveau sur l'instrument demandé, pas sur les autres : un élève avancé au
    // piano peut être débutant au chant.
    const practice = student.instruments.find(
      (entry) => entry.instrumentId === booking.instrument.id
    );
    const guardian = guardianSummary(student, now);

    return {
      id: booking.id,
      status: booking.status,
      startsAt: booking.startsAt.toISOString(),
      endsAt: booking.endsAt.toISOString(),
      mode: booking.mode,
      isTrial: booking.isTrial,
      priceCents: booking.priceCents,
      studentMessage: booking.studentMessage,
      instrumentName: booking.instrument.name,
      studentName: student.user.name,
      studentLevel: practice?.level ?? null,
      studentYears: practice?.yearsPracticed ?? null,
      studentOwnsInstrument: practice?.ownsInstrument ?? null,
      studentReadsSheetMusic: student.readsSheetMusic,
      studentGoals: student.goals,
      studentAge: guardian.age,
      guardianContact: guardian.contact,
      studentIsMinor: guardian.isMinor,
    };
  });

  const profile = user.teacherProfile;

  // L'avertissement ne s'affiche que sur une boîte réellement vide : un prof
  // qui a déjà des cours sait que sa fiche fonctionne, et le répéter le
  // transformerait en bruit.
  const blocker =
    rows.length === 0
      ? visibilityBlocker({
          publishable: checkPublishable({
            headline: profile.headline,
            bio: profile.bio,
            hourlyRateCents: profile.hourlyRateCents,
            teachesOnline: profile.teachesOnline,
            teachesInPerson: profile.teachesInPerson,
            teachesAtHome: profile.teachesAtHome,
            city: profile.city,
            instrumentCount: profile._count.instruments,
            availabilityRuleCount: profile._count.rules,
          }).ok,
          published: profile.status === "PUBLISHED",
          subscribed: isSubscriptionActive(profile.stripeCurrentPeriodEnd, now),
        })
      : null;

  return (
    <div className="flex flex-col gap-6">
      {blocker ? <TeacherVisibilityNotice blocker={blocker} /> : null}
      <TeacherBookings initial={rows} timezone={user.timezone} />
    </div>
  );
}
