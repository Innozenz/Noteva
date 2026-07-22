import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * Porte d'entrée de l'espace connecté.
 *
 * C'est ici, et pas dans le middleware, que se fait le contrôle du rôle : le
 * middleware s'exécute sur l'edge, ne voit que la présence du cookie de
 * session et n'a pas accès à Prisma. Un Server Component peut lire la base,
 * donc rediriger vers l'onboarding tant que `role` est nul.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (!user?.role) {
    redirect("/onboarding");
  }

  return (
    <>
      {/* Le seul chemin vers les espaces dédiés : sans ce bandeau, les écrans
          construits jusqu'ici ne sont atteignables qu'en tapant l'URL. */}
      <div className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2">
          <span className="text-sm text-zinc-500">
            {user.role === "TEACHER" ? "Compte prof" : "Compte élève"}
          </span>
          <Link
            href={user.role === "TEACHER" ? "/dashboard/prof" : "/dashboard/cours"}
            className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
          >
            {user.role === "TEACHER" ? "Espace prof" : "Mes cours"}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
      {children}
    </>
  );
}
