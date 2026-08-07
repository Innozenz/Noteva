"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck, Star, Users } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Onglets de l'espace d'administration.
 *
 * Client pour la seule raison qui l'impose partout ailleurs (`TeacherTabs`,
 * `FicheTabs`) : marquer l'onglet courant demande `usePathname`. La liste vit
 * ici plutôt que dans le layout parce qu'une icône Lucide est un composant, et
 * un composant ne traverse pas la frontière serveur → client.
 */
const TABS = [
  { href: "/admin/utilisateurs", label: "Utilisateurs", icon: Users },
  { href: "/admin/avis", label: "Avis", icon: Star },
];

export function AdminTabs() {
  const pathname = usePathname();

  return (
    <nav className="mx-auto flex max-w-4xl items-center gap-1 px-4">
      <span className="flex items-center gap-2 py-4 pr-4 text-sm font-semibold">
        <ShieldCheck className="h-4 w-4 text-primary" />
        Administration
      </span>
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-4 text-sm font-medium transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}