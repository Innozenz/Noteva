import Link from "next/link";
import { Music4, Search } from "lucide-react";

import { UserNav, type NavUser } from "@/components/user-nav";
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
 * Le rôle **et l'identité** sont passés par le layout, qui a déjà lu
 * l'utilisateur pour son propre contrôle : les relire ici ferait une requête de
 * plus par page, et les lire côté client les ferait clignoter — puis rester
 * périmés après un changement de nom, la session étant mise en cache.
 */
export function AppHeader({
  role,
  user,
}: {
  role: "TEACHER" | "STUDENT" | "ADMIN";
  user: NavUser;
}) {
  // Le logo renvoie au hub `/dashboard`, pas à une sous-page : « chez soi »,
  // une fois connecté, c'est le tableau de bord, qui route ensuite selon le
  // rôle. L'admin, lui, n'a pas de hub `/dashboard` (il y serait redirigé) :
  // on l'envoie droit à son espace.
  const home = role === "ADMIN" ? "/admin/avis" : "/dashboard";

  return (
    <header className="border-b border-border bg-white">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        {/* Le logo renvoie à l'espace de l'utilisateur, pas à l'accueil public. */}
        <Link href={home} className="flex items-center gap-2 font-semibold">
          <Music4 className="h-5 w-5 text-primary" />
          SiNote
        </Link>

        <nav className="flex items-center gap-1">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/profs">
              <Search className="mr-2 h-4 w-4" />
              Trouver un prof
            </Link>
          </Button>
          <UserNav role={role} user={user} />
        </nav>
      </div>
    </header>
  );
}
