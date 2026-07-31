import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * Espace élève.
 *
 * Deuxième porte, après celle de /dashboard : le layout parent garantit qu'un
 * rôle est posé, celui-ci qu'il s'agit bien d'un élève. Symétrique du layout
 * prof — le shell (barre latérale, marge du contenu) est porté par le layout
 * parent ; ce layout ne fait plus que garder la porte.
 */
export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/");
  }

  const student = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!student) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
