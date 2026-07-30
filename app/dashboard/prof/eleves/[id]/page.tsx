import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, FileText } from "lucide-react";

import { PageTitle } from "@/components/editorial";
import { FicheTabs } from "@/components/fiche-tabs";
import { MessageThread } from "@/components/message-thread";
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
 * Agrège tout ce que le prof sait de cet élève, organisé en onglets (profil,
 * historique, comptes rendus, messages, note privée). L'onglet actif vit dans
 * l'URL. Accessible seulement si le prof a au moins un cours avec lui — sinon
 * 404, comme partout.
 */
export default async function StudentFilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ onglet?: string }>;
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
      teacherNotes: {
        where: { teacherId: teacher.id },
        select: { content: true },
        take: 1,
      },
      // Fil général du couple (messages hors compte rendu).
      messages: {
        where: { teacherId: teacher.id, reportId: null },
        orderBy: { createdAt: "asc" },
        select: { id: true, sender: true, content: true, createdAt: true },
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

  const reports = student.bookings.filter(
    (b) =>
      b.report &&
      (b.report.content ||
        b.report.attachments.length > 0 ||
        b.report.comments.length > 0)
  );
  const messages = student.messages.map((m) => ({
    ...m,
    createdAt: m.createdAt.toISOString(),
  }));

  const tabs = [
    { key: "profil", label: "Profil" },
    { key: "historique", label: "Historique", badge: student.bookings.length },
    { key: "comptes-rendus", label: "Comptes rendus", badge: reports.length },
    { key: "messages", label: "Messages", badge: messages.length },
    { key: "note", label: "Note privée" },
  ];
  const requested = (await searchParams).onglet;
  const active = tabs.some((t) => t.key === requested) ? requested! : "profil";
  const basePath = `/dashboard/prof/eleves/${student.id}`;

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

      <FicheTabs tabs={tabs} active={active} basePath={basePath} />

      {active === "profil" ? <StudentProfileBody profile={profileView} /> : null}

      {active === "note" ? (
        <StudentNoteEditor
          studentId={student.id}
          initialContent={student.teacherNotes[0]?.content ?? ""}
        />
      ) : null}

      {active === "messages" ? (
        <MessageThread
          initial={messages}
          me="TEACHER"
          postUrl={`/api/teacher/students/${student.id}/messages`}
          emptyLabel="Démarrez la conversation avec cet élève."
        />
      ) : null}

      {active === "historique" ? (
        <ul className="divide-y divide-border border-y border-border">
          {student.bookings.map((b) => {
            const documented =
              b.report &&
              (b.report.content ||
                b.report.attachments.length > 0 ||
                b.report.comments.length > 0);

            return (
              <li
                key={b.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <p className="min-w-0 text-sm">
                  <span className="font-medium">{b.instrument.name}</span>
                  <span className="text-muted">
                    {" "}
                    · {dateFormat.format(b.startsAt)}
                  </span>
                </p>
                <div className="flex shrink-0 items-center gap-3">
                  {documented ? (
                    <Link
                      href={`${basePath}?onglet=comptes-rendus#cr-${b.id}`}
                      className="flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Compte rendu
                    </Link>
                  ) : null}
                  <Badge
                    variant={b.status === "CONFIRMED" ? "success" : "secondary"}
                  >
                    {STATUS_LABELS[b.status] ?? b.status}
                  </Badge>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {active === "comptes-rendus" ? (
        reports.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface px-4 py-8 text-center text-sm text-muted">
            Aucun compte rendu pour cet élève pour l&apos;instant.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {reports.map((b) => (
              <li
                key={b.id}
                id={`cr-${b.id}`}
                className="flex scroll-mt-20 flex-col gap-3 rounded-lg border border-border p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm">
                    <span className="font-medium">{b.instrument.name}</span>
                    <span className="text-muted">
                      {" "}
                      · {dateFormat.format(b.startsAt)}
                    </span>
                  </p>
                  <Badge variant="secondary">
                    {STATUS_LABELS[b.status] ?? b.status}
                  </Badge>
                </div>
                <ReportViewer
                  bookingId={b.id}
                  me="TEACHER"
                  report={{
                    content: b.report!.content,
                    attachments: b.report!.attachments,
                    comments: b.report!.comments.map((c) => ({
                      ...c,
                      createdAt: c.createdAt.toISOString(),
                    })),
                  }}
                />
              </li>
            ))}
          </ul>
        )
      ) : null}
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
