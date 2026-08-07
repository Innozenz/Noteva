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
 * L'administration est une **capacité** (`User.isAdmin`), pas un rôle : un prof
 * ou un élève peut être admin, ce qu'une valeur `role = ADMIN` interdisait.
 *
 * **Un compte ne devient jamais administrateur par l'application.** Rien
 * n'écrit `isAdmin`. La promotion se fait à la main en base :
 *
 *     UPDATE "user" SET "isAdmin" = true WHERE email = '…';
 *
 * C'est volontaire. Une interface qui distribue les droits d'administration
 * est une surface d'attaque permanente pour un besoin qui, sur cette
 * plateforme, se produit une fois.
 *
 * Le contrôle se fait ici et pas dans le proxy, pour la même raison que
 * partout ailleurs : le proxy pourrait lire la base (runtime Node sous Next 16)
 * mais ne doit pas le faire à chaque requête interceptée ; le Server Component
 * est le bon endroit.
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
    select: { isAdmin: true },
  });

  // 404 et non 403 : confirmer l'existence d'une zone d'administration à
  // quelqu'un qui n'y a pas droit lui apprend où insister.
  if (!user?.isAdmin) {
    return { ok: false, status: 404, error: "Introuvable" };
  }

  return { ok: true, userId: session.user.id };
}
