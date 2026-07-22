import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AvailabilityEditor } from "@/components/availability-editor";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function TeacherAvailabilityPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) redirect("/");

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { timezone: true, teacherProfile: { select: { id: true } } },
  });

  if (!user.teacherProfile) redirect("/dashboard");

  const [slots, exceptions] = await Promise.all([
    prisma.availabilityRule.findMany({
      where: { teacherId: user.teacherProfile.id },
      select: { weekday: true, startMinute: true, endMinute: true },
      orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
    }),
    prisma.availabilityException.findMany({
      where: { teacherId: user.teacherProfile.id, date: { gte: startOfToday() } },
      select: {
        id: true,
        date: true,
        type: true,
        startMinute: true,
        endMinute: true,
        reason: true,
      },
      orderBy: { date: "asc" },
    }),
  ]);

  return (
    <AvailabilityEditor
      timezone={user.timezone}
      initialSlots={slots}
      initialExceptions={exceptions.map((exception) => ({
        ...exception,
        // Colonne `@db.Date` : on la relit en UTC pour ne pas décaler d'un jour.
        date: exception.date.toISOString().slice(0, 10),
      }))}
    />
  );
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
}
