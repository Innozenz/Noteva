"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * Marque le fil général d'un couple comme lu, du côté de l'utilisateur courant.
 *
 * Le côté (prof ou élève) se déduit de la session : on n'avance le repère que si
 * l'utilisateur est bien un participant de ce couple — ce qui autorise l'action
 * du même coup. `upsert` sur la clé unique (teacherId, studentId) : une seule
 * ligne d'état par fil.
 */
export async function markThreadRead(teacherId: string, studentId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return;

  const [teacher, student] = await Promise.all([
    prisma.teacherProfile.findFirst({
      where: { id: teacherId, userId: session.user.id },
      select: { id: true },
    }),
    prisma.studentProfile.findFirst({
      where: { id: studentId, userId: session.user.id },
      select: { id: true },
    }),
  ]);

  const now = new Date();
  const data = teacher
    ? { teacherReadAt: now }
    : student
      ? { studentReadAt: now }
      : null;

  // Ni prof ni élève de ce couple : rien à marquer.
  if (!data) return;

  await prisma.messageThreadState.upsert({
    where: { teacherId_studentId: { teacherId, studentId } },
    create: { teacherId, studentId, ...data },
    update: data,
  });
}
