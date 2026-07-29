import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  TeacherAgenda,
  type AgendaRow,
} from "@/components/teacher-agenda";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { addDays, civilDateKeyInZone } from "@/lib/availability/zone";
import { startOfWeek, weekRange } from "@/lib/teacher/agenda";

/**
 * Agenda hebdomadaire du prof.
 *
 * La semaine affichée vit dans l'URL (`?semaine=AAAA-MM-JJ`), pas dans un état
 * React : une semaine se partage, se met en favori, et le bouton retour ramène
 * à la précédente. Même raisonnement que les filtres de /profs.
 *
 * Rendu à la demande et non mis en cache : un cours confirmé il y a dix
 * secondes doit apparaître.
 */
export default async function TeacherAgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ semaine?: string; vue?: string; date?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) redirect("/");

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { timezone: true, teacherProfile: { select: { id: true } } },
  });

  if (!user.teacherProfile) redirect("/dashboard");

  const now = new Date();
  const timezone = user.timezone;
  const params = await searchParams;

  // Tout se lit dans le fuseau du prof : un prof à Tokyo un lundi matin ne doit
  // pas atterrir sur la semaine passée du serveur.
  const todayKey = civilDateKeyInZone(now, timezone);
  const currentWeek = startOfWeek(todayKey);
  const view = params.vue === "jour" ? "jour" : "semaine";

  const AGENDA = "/dashboard/prof/agenda";

  // `weekStart` désigne le premier jour affiché : le lundi en vue semaine, le
  // jour choisi en vue jour. Une valeur fantaisiste ramène à aujourd'hui/la
  // semaine courante plutôt qu'à une erreur — une URL tronquée reste utilisable.
  let weekStart: string;
  let days: number;
  let nav: {
    previousHref: string;
    nextHref: string;
    currentHref: string | null;
    currentLabel: string;
    weekHref: string;
    dayHref: string;
  };

  if (view === "jour") {
    weekStart = isCivilDate(params.date) ? params.date : todayKey;
    days = 1;
    nav = {
      previousHref: `${AGENDA}?vue=jour&date=${addDays(weekStart, -1)}`,
      nextHref: `${AGENDA}?vue=jour&date=${addDays(weekStart, 1)}`,
      currentHref: weekStart !== todayKey ? `${AGENDA}?vue=jour` : null,
      currentLabel: "Aujourd'hui",
      weekHref: `${AGENDA}?semaine=${startOfWeek(weekStart)}`,
      dayHref: `${AGENDA}?vue=jour&date=${weekStart}`,
    };
  } else {
    weekStart = isCivilDate(params.semaine)
      ? startOfWeek(params.semaine)
      : currentWeek;
    days = 7;
    // Depuis la semaine, « Jour » ouvre aujourd'hui si la semaine le contient,
    // sinon son lundi.
    const dayTarget =
      todayKey >= weekStart && todayKey <= addDays(weekStart, 6)
        ? todayKey
        : weekStart;
    nav = {
      previousHref: `${AGENDA}?semaine=${addDays(weekStart, -7)}`,
      nextHref: `${AGENDA}?semaine=${addDays(weekStart, 7)}`,
      currentHref: weekStart !== currentWeek ? AGENDA : null,
      currentLabel: "Cette semaine",
      weekHref: `${AGENDA}?semaine=${weekStart}`,
      dayHref: `${AGENDA}?vue=jour&date=${dayTarget}`,
    };
  }

  const range = weekRange(weekStart, timezone, days);

  const [rules, exceptions, bookings] = await Promise.all([
    prisma.availabilityRule.findMany({
      where: { teacherId: user.teacherProfile.id },
      select: {
        weekday: true,
        startMinute: true,
        endMinute: true,
        validFrom: true,
        validUntil: true,
      },
    }),
    // Les exceptions sont bornées à la semaine affichée ; le moteur ne retient
    // de toute façon que celles dont la date tombe dans le jour calculé.
    prisma.availabilityException.findMany({
      where: {
        teacherId: user.teacherProfile.id,
        date: {
          gte: civilDate(weekStart),
          lte: civilDate(addDays(weekStart, days - 1)),
        },
      },
      select: {
        date: true,
        type: true,
        startMinute: true,
        endMinute: true,
        reason: true,
      },
    }),
    prisma.booking.findMany({
      // Annulés et refusés sont exclus : ils ont libéré leur créneau, ils
      // n'occupent plus l'agenda. Leur trace reste dans les demandes.
      where: {
        teacherId: user.teacherProfile.id,
        status: { in: ["PENDING", "CONFIRMED", "COMPLETED", "NO_SHOW"] },
        startsAt: { lt: range.to },
        endsAt: { gt: range.from },
      },
      orderBy: { startsAt: "asc" },
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
    }),
  ]);

  const rows: AgendaRow[] = bookings.map((booking) => ({
    id: booking.id,
    status: booking.status as AgendaRow["status"],
    startsAt: booking.startsAt.toISOString(),
    endsAt: booking.endsAt.toISOString(),
    mode: booking.mode,
    isTrial: booking.isTrial,
    priceCents: booking.priceCents,
    studentMessage: booking.studentMessage,
    instrumentName: booking.instrument.name,
    studentName: booking.student.user.name,
  }));

  return (
    <TeacherAgenda
      rows={rows}
      rules={rules.map((rule) => ({
        ...rule,
        // Colonnes `@db.Date` : relues en UTC, sans quoi elles décaleraient
        // d'un jour pour tout fuseau derrière UTC.
        validFrom: toCivilKey(rule.validFrom),
        validUntil: toCivilKey(rule.validUntil),
      }))}
      exceptions={exceptions.map((exception) => ({
        ...exception,
        date: toCivilKey(exception.date)!,
      }))}
      weekStart={weekStart}
      days={days}
      view={view}
      timezone={timezone}
      nav={nav}
    />
  );
}

function isCivilDate(value: string | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Clé civile → Date à minuit UTC, la forme d'une colonne `@db.Date`. */
function civilDate(key: string): Date {
  return new Date(`${key}T00:00:00Z`);
}

function toCivilKey(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}
