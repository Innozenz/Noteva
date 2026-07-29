import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ActivityControls } from "@/components/activity-controls";
import { PageTitle, SectionTitle } from "@/components/editorial";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  computeActivity,
  formatEuros,
  formatHours,
  JOURNAL_STATUS_LABELS,
  PERIOD_LABELS,
  resolvePeriod,
  type Breakdown,
} from "@/lib/teacher/activity";

/**
 * Pilotage d'activité du prof : revenus, cours, répartitions et journal sur une
 * période, avec filtres. Server Component — le prof arrive sur ses chiffres,
 * sans état de chargement. La logique (bornes de période dans son fuseau,
 * agrégats) vit dans `lib/teacher/activity.ts`, pure et testée.
 */
export default async function ActivitePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/");

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: {
      timezone: true,
      teacherProfile: {
        select: {
          id: true,
          instruments: {
            select: { instrument: { select: { slug: true, name: true } } },
            orderBy: { instrument: { name: "asc" } },
          },
        },
      },
    },
  });

  if (!user.teacherProfile) redirect("/dashboard");

  const params = await searchParams;
  const first = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : null;

  const now = new Date();
  const period = resolvePeriod(
    { periode: first("periode"), debut: first("debut"), fin: first("fin") },
    now,
    user.timezone
  );
  const instrumentSlug = first("instrument");

  const bookings = await prisma.booking.findMany({
    where: {
      teacherId: user.teacherProfile.id,
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

  const instruments = user.teacherProfile.instruments.map((i) => i.instrument);

  const stats = [
    { label: "Revenus réalisés", value: formatEuros(report.realizedCents) },
    { label: "Prévu (à venir)", value: formatEuros(report.projectedCents) },
    { label: "Cours donnés", value: String(report.realizedCount) },
    { label: "Panier moyen", value: formatEuros(report.avgCents) },
  ];

  const maxMonth = Math.max(1, ...report.byMonth.map((m) => m.cents));
  const isEmpty = report.journal.length === 0;
  const JOURNAL_CAP = 60;

  const dateTime = (instant: Date) =>
    instant.toLocaleString("fr-FR", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: user.timezone,
    });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
      <header className="flex flex-col gap-5 border-b border-border pb-8">
        <div className="flex flex-col gap-2">
          <PageTitle size="page">Activité</PageTitle>
          <p className="text-sm text-muted">
            Vos revenus sur une période — réglés directement par vos élèves, hors
            plateforme.
          </p>
        </div>
        <ActivityControls instruments={instruments} />
      </header>

      {/* Chiffres clés de la période. */}
      <section>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-background p-5">
              <p className="font-display text-3xl font-semibold leading-none text-foreground">
                {stat.value}
              </p>
              <p className="mt-2 text-sm text-muted">{stat.label}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-subtle">
          {`${PERIOD_LABELS[period.preset]} · ${formatHours(report.taughtMinutes)} enseignées. Le réalisé ne compte que les cours clôturés.`}
        </p>
      </section>

      {isEmpty ? (
        <p className="border-t border-border pt-10 text-muted">
          Aucun cours sur cette période. Changez de période ou de filtre
          ci-dessus.
        </p>
      ) : (
        <>
          {report.byMonth.length >= 2 ? (
            <section className="flex flex-col gap-5">
              <SectionTitle>Évolution</SectionTitle>
              <div className="flex h-44 items-end gap-2">
                {report.byMonth.map((month) => (
                  <div
                    key={month.key}
                    className="flex flex-1 flex-col items-center gap-2"
                    title={`${month.label} — ${formatEuros(month.cents)} (${month.count} cours)`}
                  >
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className="w-full rounded-t bg-primary"
                        style={{
                          height: `${(month.cents / maxMonth) * 100}%`,
                          minHeight: month.cents > 0 ? "3px" : "0",
                        }}
                      />
                    </div>
                    <span className="text-xs text-subtle">{month.label}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <div className="grid gap-10 sm:grid-cols-2">
            <BreakdownList
              title="Par instrument"
              rows={report.byInstrument}
              empty="Aucun cours clôturé."
            />
            <BreakdownList
              title="Par élève"
              rows={report.byStudent}
              empty="Aucun cours clôturé."
            />
          </div>

          <section className="flex flex-col gap-4">
            <SectionTitle>Journal des cours</SectionTitle>
            <ul className="divide-y divide-border border-y border-border">
              {report.journal.slice(0, JOURNAL_CAP).map((row, index) => (
                <li
                  key={index}
                  className="flex items-start justify-between gap-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {row.studentName}
                      <span className="text-muted"> · {row.instrumentName}</span>
                      {row.isTrial ? (
                        <span className="text-subtle"> · essai</span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-sm text-muted">
                      <span className="first-letter:uppercase">
                        {dateTime(row.startsAt)}
                      </span>
                      {` · ${row.durationMin} min`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-medium">{formatEuros(row.cents)}</p>
                    <Badge
                      variant={
                        row.status === "COMPLETED"
                          ? "success"
                          : row.status === "NO_SHOW"
                            ? "warning"
                            : "secondary"
                      }
                      className="mt-1"
                    >
                      {JOURNAL_STATUS_LABELS[row.status] ?? row.status}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
            {report.journal.length > JOURNAL_CAP ? (
              <p className="text-sm text-subtle">
                {`${report.journal.length - JOURNAL_CAP} cours de plus — utilisez l'export CSV pour le détail complet.`}
              </p>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}

/** Répartition avec une barre proportionnelle par ligne. */
function BreakdownList({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: Breakdown[];
  empty: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.cents));

  return (
    <section className="flex flex-col gap-4">
      <SectionTitle>{title}</SectionTitle>
      {rows.length === 0 ? (
        <p className="text-sm text-subtle">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.label} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium">{row.label}</span>
                <span className="shrink-0 text-muted">
                  {`${row.count} cours · `}
                  <span className="font-medium text-foreground">
                    {formatEuros(row.cents)}
                  </span>
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-strong">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(row.cents / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
