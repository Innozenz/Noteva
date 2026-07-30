import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { StudentNav } from "@/components/student-nav";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * Espace élève.
 *
 * Deuxième porte, après celle de /dashboard : le layout parent garantit qu'un
 * rôle est posé, celui-ci qu'il s'agit bien d'un élève. Symétrique du layout
 * prof — même structure à deux colonnes (nav à gauche, contenu à droite ; sur
 * mobile la nav repasse en rangée au-dessus).
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

  return (
    <div className="gap-8 px-4 py-8 lg:flex lg:py-10">
      <StudentNav />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
