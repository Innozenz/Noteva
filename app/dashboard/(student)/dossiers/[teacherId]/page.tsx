import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { PageTitle, SectionTitle } from "@/components/editorial";
import { MessageThread } from "@/components/message-thread";
import { ReportViewer } from "@/components/report-view";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  CONFIRMED: "Confirmé",
  CANCELLED: "Annulé",
  COMPLETED: "Terminé",
  NO_SHOW: "Non honoré",
  DECLINED: "Refusé",
};

/**
 * Dossier partagé, vu par l'élève.
 *
 * Le pendant de la fiche élève côté prof : un hub par relation prof↔élève qui
 * centralise les cours, leurs comptes rendus (et commentaires) et les échanges.
 * La note privée du prof n'y figure pas — elle lui reste réservée. Accessible
 * seulement si l'élève a au moins un cours avec ce prof, sinon 404.
 */
export default async function StudentDossierPage({
  params,
}: {
  params: Promise<{ teacherId: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) redirect("/");

  const student = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!student) redirect("/dashboard");

  const { teacherId } = await params;

  const teacher = await prisma.teacherProfile.findFirst({
    where: { id: teacherId, bookings: { some: { studentId: student.id } } },
    select: {
      id: true,
      slug: true,
      user: { select: { name: true, image: true, timezone: true } },
      bookings: {
        where: { studentId: student.id },
        orderBy: { startsAt: "desc" },
        select: {
          id: true,
          startsAt: true,
          status: true,
          instrument: { select: { name: true } },
          report: {
            select: {
              content: true,
              attachments: {
                orderBy: { createdAt: "asc" },
                select: {
                  id: true,
                  filename: true,
                  contentType: true,
                  kind: true,
                  sizeBytes: true,
                },
              },
              comments: {
                orderBy: { createdAt: "asc" },
                select: {
                  id: true,
                  sender: true,
                  content: true,
                  createdAt: true,
                },
              },
            },
          },
        },
      },
      messages: {
        where: { studentId: student.id, reportId: null },
        orderBy: { createdAt: "asc" },
        select: { id: true, sender: true, content: true, createdAt: true },
      },
    },
  });

  if (!teacher) notFound();

  const now = new Date();
  const name = teacher.user.name ?? "Professeur";

  const lessons = teacher.bookings.filter(
    (b) => b.status === "CONFIRMED" || b.status === "COMPLETED"
  );
  const stats = {
    total: lessons.length,
    upcoming: lessons.filter((b) => b.startsAt > now).length,
    completed: teacher.bookings.filter((b) => b.status === "COMPLETED").length,
  };

  const dateFormat = new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: teacher.user.timezone,
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Link
          href="/dashboard/dossiers"
          className="flex w-fit items-center gap-1 text-sm text-muted hover:underline"
        >
          <ChevronLeft className="h-3 w-3" />
          Mes dossiers
        </Link>

        <div className="flex items-center gap-4 border-b border-border pb-6">
          <Avatar className="h-16 w-16 shrink-0 border border-border">
            <AvatarImage src={teacher.user.image || undefined} alt={name} />
            <AvatarFallback>{name.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <PageTitle size="page">{name}</PageTitle>
            <Link
              href={`/profs/${teacher.slug}`}
              className="mt-1 inline-block text-sm text-primary hover:underline"
            >
              Voir la fiche publique
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat value={stats.total} label="Cours" />
        <Stat value={stats.upcoming} label="À venir" />
        <Stat value={stats.completed} label="Terminés" />
      </div>

      {/* Cours & comptes rendus */}
      <section className="flex flex-col gap-4">
        <SectionTitle>Cours &amp; comptes rendus</SectionTitle>
        <ul className="flex flex-col gap-3">
          {teacher.bookings.map((b) => {
            const report =
              b.report &&
              (b.report.content ||
                b.report.attachments.length > 0 ||
                b.report.comments.length > 0)
                ? b.report
                : null;

            return (
              <li
                key={b.id}
                className="flex flex-col gap-3 rounded-lg border border-border p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm">
                    <span className="font-medium">{b.instrument.name}</span>
                    <span className="text-muted">
                      {" "}
                      · {dateFormat.format(b.startsAt)}
                    </span>
                  </p>
                  <Badge variant={b.status === "CONFIRMED" ? "success" : "secondary"}>
                    {STATUS_LABELS[b.status] ?? b.status}
                  </Badge>
                </div>

                {report ? (
                  <ReportViewer
                    bookingId={b.id}
                    me="STUDENT"
                    report={{
                      content: report.content,
                      attachments: report.attachments,
                      comments: report.comments.map((c) => ({
                        ...c,
                        createdAt: c.createdAt.toISOString(),
                      })),
                    }}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Échanges */}
      <section className="flex flex-col gap-3">
        <SectionTitle>Échanges</SectionTitle>
        <MessageThread
          initial={teacher.messages.map((m) => ({
            ...m,
            createdAt: m.createdAt.toISOString(),
          }))}
          me="STUDENT"
          postUrl={`/api/student/teachers/${teacher.id}/messages`}
          emptyLabel="Écrivez un message à votre prof."
        />
      </section>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3 text-center">
      <p className="font-display text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
