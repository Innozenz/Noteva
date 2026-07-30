import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * Résout le profil élève de l'utilisateur courant.
 *
 * Symétrique de `requireTeacher` : chaque route /api/student agit sur « mon »
 * profil, jamais sur un profil passé en paramètre.
 */
export type StudentSession =
  | { ok: true; studentId: string; userId: string }
  | { ok: false; status: number; error: string };

export async function requireStudent(): Promise<StudentSession> {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return { ok: false, status: 401, error: "Non authentifié" };
  }

  const student = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!student) {
    return { ok: false, status: 403, error: "Profil élève requis" };
  }

  return { ok: true, studentId: student.id, userId: session.user.id };
}
