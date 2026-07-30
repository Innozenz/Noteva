"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarClock,
  FolderOpen,
  LayoutDashboard,
  Search,
  UserCog,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Navigation de l'espace élève.
 *
 * Symétrique de `TeacherNav` : sidebar verticale sur grand écran, rangée
 * horizontale défilante sur mobile. Client Component pour marquer l'entrée
 * courante (`usePathname`). La liste vit ici car les icônes ne traversent pas
 * la frontière serveur → client.
 */
const ITEMS = [
  { href: "/dashboard/cours", icon: CalendarClock, label: "Mes cours" },
  { href: "/dashboard/dossiers", icon: FolderOpen, label: "Mes dossiers" },
  { href: "/dashboard/cours/profil", icon: UserCog, label: "Mon profil" },
  { href: "/profs", icon: Search, label: "Trouver un prof" },
] as const;

const ITEM_CLASS =
  "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors";

export function StudentNav() {
  const pathname = usePathname();
  const activeRef = useRef<HTMLAnchorElement>(null);

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

      <span aria-hidden className="hidden h-px shrink-0 bg-border lg:my-2 lg:block" />

      {ITEMS.map((item) => {
        const Icon = item.icon;
        // « Mes cours » est la racine : sans l'égalité stricte elle resterait
        // active sur « Mon profil », qui est un sous-chemin.
        const active =
          item.href === "/dashboard/cours"
            ? pathname === item.href
            : pathname.startsWith(item.href);

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
          </Link>
        );
      })}
    </nav>
  );
}
