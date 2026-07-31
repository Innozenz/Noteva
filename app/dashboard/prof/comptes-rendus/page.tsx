import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { PageTitle } from "@/components/editorial";
import { ReportEditor, type ReportEditorLesson } from "@/components/report-editor";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * Comptes rendus de cours.
 *
 * Liste les cours que le prof peut documenter — confirmés ou terminés et déjà
 * commencés — du plus récent au plus ancien. Chaque carte s'ouvre sur l'éditeur
 * (texte + pièces jointes + note audio). L'élève retrouve le compte rendu sur
 * son propre tableau de bord.
 */
export default async function TeacherReportsPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) redirect("/");

  const teacher = await prisma.teacherProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, user: { select: { timezone: true } } },
  });

  if (!teacher) redirect("/dashboard");

  const now = new Date();

  const bookings = await prisma.booking.findMany({
    where: {
      teacherId: teacher.id,
      status: { in: ["CONFIRMED", "COMPLETED"] },
      startsAt: { lte: now },
    },
    orderBy: { startsAt: "desc" },
    take: 100,
    select: {
      id: true,
      startsAt: true,
      isTrial: true,
      instrument: { select: { name: true } },
      student: { select: { user: { select: { name: true } } } },
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
  });

  const dateFormat = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: teacher.user.timezone,
  });

  const lessons: ReportEditorLesson[] = bookings.map((b) => ({
    bookingId: b.id,
    dateLabel: dateFormat.format(b.startsAt),
    studentName: b.student.user.name ?? "Élève",
    instrumentName: b.instrument.name,
    isTrial: b.isTrial,
    content: b.report?.content ?? "",
    attachments: b.report?.attachments ?? [],
  }));

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-2 border-b border-border pb-6">
        <PageTitle size="page">Comptes rendus</PageTitle>
        <p className="text-sm text-muted">
          Documentez chaque cours pour votre élève : ce qui a été travaillé, des
          images ou partitions, une note audio.
        </p>
      </header>

      {lessons.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface px-4 py-8 text-center text-sm text-muted">
          Aucun cours à documenter pour l&apos;instant. Un compte rendu s&apos;ouvre
          dès qu&apos;un cours confirmé a commencé.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {lessons.map((lesson) => (
            <ReportEditor key={lesson.bookingId} lesson={lesson} />
          ))}
        </div>
      )}
    </div>
  );
}
