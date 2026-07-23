import Link from "next/link";
import { Music4, Search } from "lucide-react";

import { UserNav } from "@/components/user-nav";
import { Button } from "@/components/ui/button";

/**
 * En-tête de l'espace connecté.
 *
 * Même coquille que `SiteHeader` — hauteur, logo, largeur — pour qu'on ne
 * change pas de site en se connectant. C'est la seule chose que l'ancien
 * bandeau ne faisait pas : il n'affichait ni le nom du produit, ni de retour
 * vers les pages publiques, ni de moyen de se déconnecter, et l'espace prof
 * empilait donc deux barres sans identité.
 *
 * Le rôle est passé par le layout, qui l'a déjà lu pour son propre contrôle :
 * le relire ici ferait une requête de plus par page.
 */
export function AppHeader({ role }: { role: "TEACHER" | "STUDENT" | "ADMIN" }) {
  const home =
    role === "TEACHER"
      ? "/dashboard/prof"
      : role === "ADMIN"
        ? "/admin/avis"
        : "/dashboard/cours";

  return (
    <header className="border-b border-border bg-white">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        {/* Le logo renvoie à l'espace de l'utilisateur, pas à l'accueil : une
            fois connecté, « chez soi » c'est son tableau de bord. */}
        <Link href={home} className="flex items-center gap-2 font-semibold">
          <Music4 className="h-5 w-5 text-primary" />
          Noteva
        </Link>

        <nav className="flex items-center gap-1">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/profs">
              <Search className="mr-2 h-4 w-4" />
              Trouver un prof
            </Link>
          </Button>
          <UserNav role={role} />
        </nav>
      </div>
    </header>
  );
}
