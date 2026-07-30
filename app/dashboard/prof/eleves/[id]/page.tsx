import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { PageTitle, SectionTitle } from "@/components/editorial";
import { ReportViewer } from "@/components/report-view";
import { StudentNoteEditor } from "@/components/student-note-editor";
import {
  StudentProfileBody,
  type StudentProfileView,
} from "@/components/student-profile-detail";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isMinor } from "@/lib/student/profile";
import { ageOn } from "@/lib/user/age";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  CONFIRMED: "Confirmé",
  CANCELLED: "Annulé",
  COMPLETED: "Terminé",
  NO_SHOW: "Non honoré",
  DECLINED: "Refusé",
};

/**
 * Fiche d'un élève, vue par le prof.
 *
 * Agrège tout ce que le prof sait de cet élève : profil, statistiques, cours et
 * comptes rendus, plus une note privée. Accessible seulement si le prof a au
 * moins un cours avec lui — sinon 404, comme partout.
 */
export default async function StudentFilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) redirect("/");

  const teacher = await prisma.teacherProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, user: { select: { timezone: true } } },
  });

  if (!teacher) redirect("/dashboard");

  const { id } = await params;

  const student = await prisma.studentProfile.findFirst({
    where: { id, bookings: { some: { teacherId: teacher.id } } },
    select: {
      id: true,
      birthDate: true,
      city: true,
      goals: true,
      musicalBackground: true,
      readsSheetMusic: true,
      voiceType: true,
      prefersOnline: true,
      preferredGenres: true,
      guardianName: true,
      guardianEmail: true,
      guardianPhone: true,
      user: { select: { name: true, image: true } },
      instruments: {
        select: {
          level: true,
          yearsPracticed: true,
          ownsInstrument: true,
          instrument: { select: { name: true } },
        },
      },
      bookings: {
        where: { teacherId: teacher.id },
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
            },
          },
        },
      },
      teacherNotes: {
        where: { teacherId: teacher.id },
        select: { content: true },
        take: 1,
      },
    },
  });

  // Inexistant, ou sans aucun cours avec ce prof : indiscernables, et c'est voulu.
  if (!student) notFound();

  const now = new Date();
  const name = student.user.name ?? "Élève";
  const age = student.birthDate ? ageOn(student.birthDate, now) : null;

  const profileView: StudentProfileView = {
    age,
    isMinor: isMinor(student.birthDate, now),
    city: student.city,
    goals: student.goals,
    background: student.musicalBackground,
    readsSheetMusic: student.readsSheetMusic,
    voiceType: student.voiceType,
    prefersOnline: student.prefersOnline,
    genres: student.preferredGenres,
    instruments: student.instruments.map((e) => ({
      name: e.instrument.name,
      level: e.level,
      yearsPracticed: e.yearsPracticed,
      ownsInstrument: e.ownsInstrument,
    })),
    guardian: {
      name: student.guardianName,
      email: student.guardianEmail,
      phone: student.guardianPhone,
    },
  };

  const lessons = student.bookings.filter(
    (b) => b.status === "CONFIRMED" || b.status === "COMPLETED"
  );
  const stats = {
    total: lessons.length,
    upcoming: lessons.filter((b) => b.startsAt > now).length,
    completed: student.bookings.filter((b) => b.status === "COMPLETED").length,
  };
  const first = lessons
    .map((b) => b.startsAt)
    .sort((a, b) => a.getTime() - b.getTime())[0];

  const dateFormat = new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: teacher.user.timezone,
  });
  const monthFormat = new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: teacher.user.timezone,
  });

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Link
          href="/dashboard/prof/eleves"
          className="flex w-fit items-center gap-1 text-sm text-muted hover:underline"
        >
          <ChevronLeft className="h-3 w-3" />
          Mes élèves
        </Link>

        <div className="flex items-center gap-4 border-b border-border pb-6">
          <Avatar className="h-16 w-16 shrink-0 border border-border">
            <AvatarImage src={student.user.image || undefined} alt={name} />
            <AvatarFallback>{name.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <PageTitle size="page">{name}</PageTitle>
            <p className="mt-1 text-sm text-muted">
              {[
                age !== null ? `${age} ans` : null,
                student.city,
                first ? `élève depuis ${monthFormat.format(first)}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-3 gap-3">
        <Stat value={stats.total} label="Cours" />
        <Stat value={stats.upcoming} label="À venir" />
        <Stat value={stats.completed} label="Terminés" />
      </div>

      {/* Profil */}
      <section className="flex flex-col gap-4">
        <SectionTitle>Profil de l&apos;élève</SectionTitle>
        <StudentProfileBody profile={profileView} />
      </section>

      {/* Note privée */}
      <section className="flex flex-col gap-3">
        <SectionTitle>Note privée</SectionTitle>
        <StudentNoteEditor
          studentId={student.id}
          initialContent={student.teacherNotes[0]?.content ?? ""}
        />
      </section>

      {/* Cours & comptes rendus */}
      <section className="flex flex-col gap-4">
        <SectionTitle>Cours &amp; comptes rendus</SectionTitle>
        <ul className="flex flex-col gap-3">
          {student.bookings.map((b) => {
            const hasReport =
              b.report &&
              (b.report.content || b.report.attachments.length > 0);

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
                  <Badge
                    variant={
                      b.status === "CONFIRMED"
                        ? "success"
                        : b.status === "COMPLETED"
                          ? "secondary"
                          : "secondary"
                    }
                  >
                    {STATUS_LABELS[b.status] ?? b.status}
                  </Badge>
                </div>

                {hasReport && b.report ? (
                  <ReportViewer bookingId={b.id} report={b.report} />
                ) : null}
              </li>
            );
          })}
        </ul>
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
