import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * Résout le profil prof de l'utilisateur courant.
 *
 * Facteur commun de toutes les routes /api/teacher : chacune agit sur « ma »
 * fiche, jamais sur une fiche passée en paramètre. C'est ce qui rend
 * l'autorisation triviale — il n'y a pas d'identifiant à valider, donc pas de
 * fiche d'autrui à atteindre par erreur.
 */
export type TeacherSession =
  | { ok: true; teacherId: string; userId: string }
  | { ok: false; status: number; error: string };

export async function requireTeacher(): Promise<TeacherSession> {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return { ok: false, status: 401, error: "Non authentifié" };
  }

  const teacher = await prisma.teacherProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!teacher) {
    return { ok: false, status: 403, error: "Profil prof requis" };
  }

  return { ok: true, teacherId: teacher.id, userId: session.user.id };
}
