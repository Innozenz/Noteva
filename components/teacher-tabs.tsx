"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, CreditCard, Inbox, Star, UserCog } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Onglets de l'espace prof.
 *
 * Client Component pour une seule raison : marquer l'onglet courant demande de
 * connaître l'URL, donc `usePathname`. Sans ce repère, cinq onglets identiques
 * ne disent jamais où l'on est — c'est ce qui manquait.
 *
 * La liste vit **ici** et non dans le layout : les icônes sont des composants,
 * et un composant ne traverse pas la frontière serveur → client (« Only plain
 * objects can be passed to Client Components »). Le layout ne passe donc que
 * le compteur, qui est un nombre.
 */

const TABS = [
  { href: "/dashboard/prof", icon: UserCog, label: "Ma fiche" },
  {
    href: "/dashboard/prof/disponibilites",
    icon: CalendarDays,
    label: "Disponibilités",
  },
  { href: "/dashboard/prof/demandes", icon: Inbox, label: "Demandes" },
  { href: "/dashboard/prof/avis", icon: Star, label: "Avis" },
  {
    href: "/dashboard/prof/abonnement",
    icon: CreditCard,
    label: "Abonnement",
  },
] as const;

export function TeacherTabs({ pendingCount }: { pendingCount: number }) {
  const pathname = usePathname();
  const activeRef = useRef<HTMLAnchorElement>(null);

  /**
   * Sur mobile la barre défile horizontalement, et les derniers onglets sont
   * hors champ : on arrivait sur « Avis » en voyant « Ma fiche » souligné
   * nulle part. On amène donc l'onglet courant dans le champ.
   */
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pathname]);

  return (
    <nav className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-4">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        // « Ma fiche » est la racine : sans l'égalité stricte, elle resterait
        // active sur tous les sous-onglets.
        const active =
          tab.href === "/dashboard/prof"
            ? pathname === tab.href
            : pathname.startsWith(tab.href);
        const badge =
          tab.href === "/dashboard/prof/demandes" ? pendingCount : 0;

        return (
          <Link
            key={tab.href}
            ref={active ? activeRef : undefined}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2 border-b-2 px-4 py-4 text-sm font-medium transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted hover:border-border-strong hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
            {badge > 0 ? (
              <span className="rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                {badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
