import { notifyInBackground } from "@/lib/notifications/send";
import { buildNotification } from "@/lib/notifications/templates";
import prisma from "@/lib/prisma";

/**
 * Prévient l'autre partie d'un nouveau message (commentaire ou fil général),
 * sans bloquer la réponse HTTP.
 *
 * Réutilise `buildNotification` — donc l'invariant « ne jamais notifier
 * l'acteur ». Les champs propres à une réservation (instrument, date) ne servent
 * pas ici : le message n'est pas attaché à un cours précis.
 */
export async function notifyThreadMessage(params: {
  teacherId: string;
  studentId: string;
  actor: "teacher" | "student";
}) {
  const [teacher, student] = await Promise.all([
    prisma.teacherProfile.findUnique({
      where: { id: params.teacherId },
      select: {
        user: { select: { name: true, email: true, timezone: true } },
      },
    }),
    prisma.studentProfile.findUnique({
      where: { id: params.studentId },
      select: { user: { select: { name: true, email: true } } },
    }),
  ]);

  if (!teacher || !student) return;

  notifyInBackground(
    buildNotification(
      "message_received",
      {
        teacherName: teacher.user.name,
        teacherEmail: teacher.user.email,
        studentName: student.user.name,
        studentEmail: student.user.email,
        instrumentName: "",
        startsAt: new Date(),
        timezone: teacher.user.timezone,
        isTrial: false,
        appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      },
      params.actor
    )
  );
}
