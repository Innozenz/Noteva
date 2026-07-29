import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Cibles de navigation de l'agenda, calculées côté serveur — l'état (vue,
 * période) vit dans l'URL. Partagé par les vues jour/semaine et la vue mois.
 */
export type AgendaNav = {
  previousHref: string;
  nextHref: string;
  /** « Aujourd'hui » / « Cette semaine » / « Ce mois », ou `null` si on y est. */
  currentHref: string | null;
  currentLabel: string;
  dayHref: string;
  weekHref: string;
  monthHref: string;
};

export type AgendaView = "jour" | "semaine" | "mois";

/** Bascule Jour / Semaine / Mois, en liens (partageable, retour arrière). */
export function AgendaViewSwitch({
  view,
  nav,
}: {
  view: AgendaView;
  nav: AgendaNav;
}) {
  const items: { key: AgendaView; label: string; href: string }[] = [
    { key: "jour", label: "Jour", href: nav.dayHref },
    { key: "semaine", label: "Semaine", href: nav.weekHref },
    { key: "mois", label: "Mois", href: nav.monthHref },
  ];

  return (
    <div className="flex rounded-md border border-border p-0.5">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={view === item.key ? "page" : undefined}
          className={cn(
            "rounded px-2.5 py-1 text-sm transition-colors",
            view === item.key
              ? "bg-surface font-medium text-foreground"
              : "text-muted hover:text-foreground"
          )}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
