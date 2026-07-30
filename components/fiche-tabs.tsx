import Link from "next/link";

import { cn } from "@/lib/utils";

export type FicheTab = { key: string; label: string; badge?: number };

/**
 * Barre d'onglets d'une fiche / d'un dossier.
 *
 * L'onglet actif vit dans l'URL (`?onglet=…`) : le rendu reste côté serveur,
 * l'état est partageable et le bouton retour se comporte bien — même logique que
 * les filtres de recherche et la semaine de l'agenda. Le premier onglet est le
 * défaut et pointe sur l'URL nue (sans paramètre), pour une adresse canonique.
 */
export function FicheTabs({
  tabs,
  active,
  basePath,
}: {
  tabs: FicheTab[];
  active: string;
  basePath: string;
}) {
  return (
    <div className="-mx-1 flex gap-1 overflow-x-auto border-b border-border px-1">
      {tabs.map((tab, index) => {
        const isActive = tab.key === active;
        const href = index === 0 ? basePath : `${basePath}?onglet=${tab.key}`;

        return (
          <Link
            key={tab.key}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-primary text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            )}
          >
            {tab.label}
            {tab.badge ? (
              <span className="rounded-full bg-surface-strong px-1.5 text-xs font-semibold text-muted">
                {tab.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
