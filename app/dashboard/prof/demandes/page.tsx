import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  TeacherBookings,
  type BookingRow,
} from "@/components/teacher-bookings";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

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
    select: { timezone: true, teacherProfile: { select: { id: true } } },
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
      instrument: { select: { name: true } },
      student: { select: { user: { select: { name: true } } } },
    },
  });

  const rows: BookingRow[] = bookings.map((booking) => ({
    id: booking.id,
    status: booking.status,
    startsAt: booking.startsAt.toISOString(),
    endsAt: booking.endsAt.toISOString(),
    mode: booking.mode,
    isTrial: booking.isTrial,
    priceCents: booking.priceCents,
    studentMessage: booking.studentMessage,
    instrumentName: booking.instrument.name,
    studentName: booking.student.user.name,
  }));

  return <TeacherBookings initial={rows} timezone={user.timezone} />;
}
