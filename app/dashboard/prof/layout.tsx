import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { TeacherTabs } from "@/components/teacher-tabs";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * Espace prof.
 *
 * Deuxième porte, après celle de /dashboard : le layout parent garantit qu'un
 * rôle est posé, celui-ci qu'il s'agit bien d'un prof. Le contrôle ne peut pas
 * remonter dans le middleware, qui n'a pas accès à la base depuis l'edge.
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
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-white">
        <TeacherTabs pendingCount={pendingCount} />
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  );
}

