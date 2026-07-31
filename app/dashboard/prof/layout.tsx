import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * Espace prof.
 *
 * Deuxième porte, après celle de /dashboard : le layout parent garantit qu'un
 * rôle est posé, celui-ci qu'il s'agit bien d'un prof. Le contrôle ne peut pas
 * remonter dans le proxy, qui n'a pas accès à la base depuis l'edge.
 *
 * Le shell (barre latérale, marge du contenu) est porté par le layout parent ;
 * ce layout ne fait plus que garder la porte.
 */
export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/");
  }

  const teacher = await prisma.teacherProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!teacher) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}

