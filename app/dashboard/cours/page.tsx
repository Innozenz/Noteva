import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Search } from "lucide-react";

import {
  StudentBookings,
  type StudentBookingRow,
} from "@/components/student-bookings";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * Cours de l'élève.
 *
 * Pendant de la boîte de réception du prof, avec une différence de fond :
 * l'élève n'a qu'une action, annuler. Confirmer, refuser et clôturer
 * appartiennent au prof, et la machine à états le fait déjà respecter côté
 * serveur — cet écran ne fait que ne pas proposer ce qui serait refusé.
 */
export default async function StudentBookingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) redirect("/");

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { timezone: true, studentProfile: { select: { id: true } } },
  });

  // Un compte prof n'a pas de profil élève : il n'a rien à voir ici.
  if (!user.studentProfile) redirect("/dashboard");

  const bookings = await prisma.booking.findMany({
    where: { studentId: user.studentProfile.id },
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
      meetingUrl: true,
      address: true,
      cancellationReason: true,
      instrument: { select: { name: true } },
      teacher: {
        select: { slug: true, user: { select: { name: true } } },
      },
    },
  });

  const rows: StudentBookingRow[] = bookings.map((booking) => ({
    id: booking.id,
    status: booking.status,
    startsAt: booking.startsAt.toISOString(),
    endsAt: booking.endsAt.toISOString(),
    mode: booking.mode,
    isTrial: booking.isTrial,
    priceCents: booking.priceCents,
    meetingUrl: booking.meetingUrl,
    address: booking.address,
    cancellationReason: booking.cancellationReason,
    instrumentName: booking.instrument.name,
    teacherName: booking.teacher.user.name,
    teacherSlug: booking.teacher.slug,
  }));

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Mes cours</h1>
        <Button variant="outline" asChild>
          <Link href="/profs">
            <Search className="mr-2 h-4 w-4" />
            Trouver un prof
          </Link>
        </Button>
      </header>

      <StudentBookings initial={rows} timezone={user.timezone} />
    </main>
  );
}
