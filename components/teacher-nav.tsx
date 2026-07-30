"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarClock,
  CalendarDays,
  CreditCard,
  FileText,
  Inbox,
  LayoutDashboard,
  Star,
  TrendingUp,
  UserCog,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Navigation de l'espace prof.
 *
 * Sidebar verticale sur grand écran, rangée horizontale défilante sur mobile
 * (une sidebar y serait inutilisable) — un seul balisage, piloté par des
 * classes responsives. Client Component pour une seule raison : marquer l'entrée
 * courante demande `usePathname`.
 *
 * La liste vit **ici** et non dans le layout : les icônes sont des composants,
 * et un composant ne traverse pas la frontière serveur → client. Le layout ne
 * passe que le compteur, un nombre.
 */

const ITEMS = [
  { href: "/dashboard/prof", icon: UserCog, label: "Ma fiche" },
  {
    href: "/dashboard/prof/disponibilites",
    icon: CalendarDays,
    label: "Disponibilités",
  },
  // « Disponibilités » déclare les horaires possibles, « Agenda » montre la
  // semaine réelle : deux questions distinctes, deux écrans.
  { href: "/dashboard/prof/agenda", icon: CalendarClock, label: "Agenda" },
  { href: "/dashboard/prof/demandes", icon: Inbox, label: "Demandes" },
  {
    href: "/dashboard/prof/comptes-rendus",
    icon: FileText,
    label: "Comptes rendus",
  },
  { href: "/dashboard/prof/eleves", icon: Users, label: "Mes élèves" },
  { href: "/dashboard/prof/activite", icon: TrendingUp, label: "Activité" },
  { href: "/dashboard/prof/avis", icon: Star, label: "Avis" },
  {
    href: "/dashboard/prof/abonnement",
    icon: CreditCard,
    label: "Abonnement",
  },
] as const;

const ITEM_CLASS =
  "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors";

export function TeacherNav({ pendingCount }: { pendingCount: number }) {
  const pathname = usePathname();
  const activeRef = useRef<HTMLAnchorElement>(null);

  /**
   * Sur mobile la rangée défile horizontalement et les derniers items sont hors
   * champ : on amène l'item courant dans le champ pour qu'il ne soit jamais
   * souligné « nulle part ».
   */
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pathname]);

  return (
    <nav
      className={cn(
        "-mx-4 flex gap-1 overflow-x-auto px-4 pb-1",
        "lg:mx-0 lg:w-56 lg:shrink-0 lg:flex-col lg:gap-0.5 lg:self-start lg:overflow-visible lg:px-0 lg:pb-0",
        "lg:sticky lg:top-8"
      )}
    >
      {/* Retour au hub, en tête de la navigation. */}
      <Link
        href="/dashboard"
        className={cn(
          ITEM_CLASS,
          "text-muted hover:bg-surface hover:text-foreground lg:w-full"
        )}
      >
        <LayoutDashboard className="h-4 w-4 shrink-0" />
        <span className="lg:flex-1">Tableau de bord</span>
      </Link>

      {/* Séparateur, sur grand écran seulement (en ligne, il n'a pas de sens). */}
      <span aria-hidden className="hidden h-px shrink-0 bg-border lg:my-2 lg:block" />

      {ITEMS.map((item) => {
        const Icon = item.icon;
        // « Ma fiche » est la racine : sans l'égalité stricte, elle resterait
        // active sur tous les sous-écrans.
        const active =
          item.href === "/dashboard/prof"
            ? pathname === item.href
            : pathname.startsWith(item.href);
        const badge =
          item.href === "/dashboard/prof/demandes" ? pendingCount : 0;

        return (
          <Link
            key={item.href}
            ref={active ? activeRef : undefined}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              ITEM_CLASS,
              "lg:w-full",
              active
                ? "bg-surface text-foreground"
                : "text-muted hover:bg-surface hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="lg:flex-1">{item.label}</span>
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
