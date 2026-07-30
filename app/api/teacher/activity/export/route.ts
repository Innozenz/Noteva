import prisma from "@/lib/prisma";
import {
  activityCsv,
  computeActivity,
  resolvePeriod,
} from "@/lib/teacher/activity";
import { requireTeacher } from "@/lib/teacher/session";

/**
 * Export CSV du journal des cours, pour la compta.
 *
 * Même période et même filtre que l'écran Activité (transmis en query), même
 * module d'agrégation. Agit sur « ma » fiche via `requireTeacher` — aucun
 * identifiant de prof accepté, donc aucune donnée d'autrui atteignable.
 */
export async function GET(request: Request) {
  const teacher = await requireTeacher();
  if (!teacher.ok) {
    return new Response(teacher.error, { status: teacher.status });
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: teacher.userId },
    select: { timezone: true },
  });

  const url = new URL(request.url);
  const q = (key: string) => url.searchParams.get(key);

  const now = new Date();
  const period = resolvePeriod(
    { periode: q("periode"), debut: q("debut"), fin: q("fin") },
    now,
    user.timezone
  );
  const instrumentSlug = q("instrument");

  const bookings = await prisma.booking.findMany({
    where: {
      teacherId: teacher.teacherId,
      startsAt: { gte: period.start, lt: period.end },
      status: { in: ["COMPLETED", "CONFIRMED", "NO_SHOW"] },
      ...(instrumentSlug ? { instrument: { slug: instrumentSlug } } : {}),
    },
    select: {
      status: true,
      startsAt: true,
      endsAt: true,
      priceCents: true,
      isTrial: true,
      instrument: { select: { name: true } },
      student: { select: { user: { select: { name: true } } } },
    },
  });

  const report = computeActivity(
    bookings.map((b) => ({
      status: b.status,
      startsAt: b.startsAt,
      endsAt: b.endsAt,
      priceCents: b.priceCents,
      isTrial: b.isTrial,
      instrumentName: b.instrument.name,
      studentName: b.student.user.name,
    })),
    period,
    now,
    user.timezone
  );

  const csv = activityCsv(report.journal, user.timezone);
  const filename = `sinote-activite-${period.startKey}_${period.endKey}.csv`;

  // BOM en tête (U+FEFF) : sans lui, Excel lit l'UTF-8 comme du Latin-1 et
  // casse les accents. Séparateur `;` (voir `activityCsv`) qu'Excel FR attend.
  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
