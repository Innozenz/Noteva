import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, Inbox, UserCog } from "lucide-react";

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
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <nav className="mx-auto flex max-w-4xl gap-1 px-4">
          <TabLink href="/dashboard/prof" icon={UserCog} label="Ma fiche" />
          <TabLink
            href="/dashboard/prof/disponibilites"
            icon={CalendarDays}
            label="Disponibilités"
          />
          <TabLink
            href="/dashboard/prof/demandes"
            icon={Inbox}
            label="Demandes"
            badge={pendingCount || undefined}
          />
        </nav>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  );
}

function TabLink({
  href,
  icon: Icon,
  label,
  badge,
}: {
  href: string;
  icon: typeof UserCog;
  label: string;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 border-b-2 border-transparent px-4 py-4 text-sm font-medium text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
    >
      <Icon className="h-4 w-4" />
      {label}
      {badge ? (
        <span className="rounded-full bg-blue-600 px-1.5 text-xs font-semibold text-white">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
