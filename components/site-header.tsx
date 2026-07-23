import { headers } from "next/headers";
import Link from "next/link";
import { Music4, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * En-tête des pages publiques.
 *
 * Server Component : le lien vers l'espace connecté dépend du rôle, qui se lit
 * en base. Rendu côté serveur, il n'y a ni clignotement au chargement ni état
 * de session à attendre côté client.
 */
export async function SiteHeader() {
  const session = await auth.api.getSession({ headers: await headers() });

  const user = session?.user
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      })
    : null;

  // Un compte sans rôle n'a pas terminé son onboarding : l'y renvoyer plutôt
  // que vers un espace qui le redirigerait de toute façon.
  const target = !user
    ? null
    : user.role === "TEACHER"
      ? "/dashboard/prof"
      : user.role === "STUDENT"
        ? "/dashboard/cours"
        : "/onboarding";

  return (
    <header className="border-b border-border bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Music4 className="h-5 w-5 text-primary" />
          Noteva
        </Link>

        <nav className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/profs">
              <Search className="mr-2 h-4 w-4" />
              Trouver un prof
            </Link>
          </Button>

          {target ? (
            <Button size="sm" asChild>
              <Link href={target}>Mon espace</Link>
            </Button>
          ) : (
            <Button size="sm" asChild>
              <Link href="/connexion">Se connecter</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
