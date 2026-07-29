import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { TeacherNav } from "@/components/teacher-nav";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * Espace prof.
 *
 * Deuxième porte, après celle de /dashboard : le layout parent garantit qu'un
 * rôle est posé, celui-ci qu'il s'agit bien d'un prof. Le contrôle ne peut pas
 * remonter dans le proxy, qui n'a pas accès à la base depuis l'edge.
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

  // Compteur dans l'onglet : une demande non traitée immobilise un créneau,
  // elle ne doit pas pouvoir passer inaperçue.
  const pendingCount = await prisma.booking.count({
    where: {
      teacherId: teacher.id,
      status: "PENDING",
      endsAt: { gt: new Date() },
    },
  });

  return (
    // Deux colonnes sur grand écran : navigation à gauche, contenu à droite.
    // Sur mobile la nav repasse en rangée horizontale au-dessus du contenu.
    //
    // Le shell prend toute la largeur : c'est chaque page qui se re-plafonne
    // (formulaires et listes à `max-w-4xl`, activité à `max-w-5xl`), tandis que
    // l'agenda, lui, s'étale sur tout `main` pour que les sept colonnes
    // respirent.
    <div className="gap-8 px-4 py-8 lg:flex lg:py-10">
      <TeacherNav pendingCount={pendingCount} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}

