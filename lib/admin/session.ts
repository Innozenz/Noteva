import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * Contrôle du rôle administrateur.
 *
 * Même forme que `requireTeacher` : les routes d'administration n'acceptent
 * aucun identifiant en paramètre qui désignerait « au nom de qui » elles
 * agissent — il n'y a qu'un rôle à vérifier, ce qui rend l'autorisation
 * triviale à relire.
 *
 * **Un compte ne devient jamais administrateur par l'application.**
 * `/api/onboarding` n'accepte que TEACHER et STUDENT, et rien d'autre n'écrit
 * ce rôle. La promotion se fait à la main en base :
 *
 *     UPDATE "user" SET role = 'ADMIN' WHERE email = '…';
 *
 * C'est volontaire. Une interface qui distribue les droits d'administration
 * est une surface d'attaque permanente pour un besoin qui, sur cette
 * plateforme, se produit une fois.
 *
 * Le contrôle se fait ici et pas dans le middleware, pour la même raison que
 * partout ailleurs : l'edge ne voit que le cookie et n'a pas accès à Prisma.
 */
export type AdminSession =
  | { ok: true; userId: string }
  | { ok: false; status: number; error: string };

export async function requireAdmin(): Promise<AdminSession> {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return { ok: false, status: 401, error: "Non authentifié" };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  // 404 et non 403 : confirmer l'existence d'une zone d'administration à
  // quelqu'un qui n'y a pas droit lui apprend où insister.
  if (user?.role !== "ADMIN") {
    return { ok: false, status: 404, error: "Introuvable" };
  }

  return { ok: true, userId: session.user.id };
}
