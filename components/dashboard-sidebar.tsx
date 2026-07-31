"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarClock,
  CalendarDays,
  CreditCard,
  FileText,
  FolderOpen,
  Inbox,
  LayoutDashboard,
  type LucideIcon,
  MessageSquare,
  Music4,
  Search,
  ShieldCheck,
  Star,
  TrendingUp,
  UserCog,
  Users,
} from "lucide-react";

import { UserNav, type NavUser } from "@/components/user-nav";
import { cn } from "@/lib/utils";

/**
 * Navigation unique de l'espace connecté.
 *
 * Une seule barre latérale porte tout — marque, navigation, recherche, compte —
 * de sorte qu'il n'y a plus d'en-tête au-dessus du contenu. Elle a une bordure
 * (droite sur grand écran, basse sur mobile) qui délimite nettement sa place.
 * Verticale sur grand écran, rangée horizontale défilante sur mobile (une
 * sidebar y serait inutilisable), le tout piloté par des classes responsives.
 *
 * Client Component pour marquer l'entrée courante (`usePathname`) ; les listes
 * d'items vivent ici car les icônes ne traversent pas la frontière serveur →
 * client. Le layout ne passe que le rôle, l'identité et un compteur.
 */
type Item = { href: string; icon: LucideIcon; label: string; exact?: boolean };

const TEACHER_ITEMS: Item[] = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Tableau de bord", exact: true },
  { href: "/dashboard/prof", icon: UserCog, label: "Ma fiche", exact: true },
  {
    href: "/dashboard/prof/disponibilites",
    icon: CalendarDays,
    label: "Disponibilités",
  },
  { href: "/dashboard/prof/agenda", icon: CalendarClock, label: "Agenda" },
  { href: "/dashboard/prof/demandes", icon: Inbox, label: "Demandes" },
  { href: "/dashboard/prof/comptes-rendus", icon: FileText, label: "Comptes rendus" },
  { href: "/dashboard/prof/eleves", icon: Users, label: "Mes élèves" },
  { href: "/dashboard/messages", icon: MessageSquare, label: "Messages" },
  { href: "/dashboard/prof/activite", icon: TrendingUp, label: "Activité" },
  { href: "/dashboard/prof/avis", icon: Star, label: "Avis" },
  { href: "/dashboard/prof/abonnement", icon: CreditCard, label: "Abonnement" },
];

const STUDENT_ITEMS: Item[] = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Tableau de bord", exact: true },
  { href: "/dashboard/cours", icon: CalendarClock, label: "Mes cours", exact: true },
  { href: "/dashboard/dossiers", icon: FolderOpen, label: "Mes dossiers" },
  { href: "/dashboard/messages", icon: MessageSquare, label: "Messages" },
  { href: "/dashboard/cours/profil", icon: UserCog, label: "Mon profil" },
];

const ADMIN_ITEMS: Item[] = [
  { href: "/admin/avis", icon: ShieldCheck, label: "Administration" },
];

const ITEM_CLASS =
  "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors lg:w-full";

export function DashboardSidebar({
  role,
  user,
  badges,
}: {
  role: "TEACHER" | "STUDENT" | "ADMIN";
  user: NavUser;
  /** Compteur par href (demandes en attente, cours avec du nouveau…). */
  badges: Record<string, number>;
}) {
  const pathname = usePathname();
  const activeRef = useRef<HTMLAnchorElement>(null);

  const items =
    role === "TEACHER"
      ? TEACHER_ITEMS
      : role === "STUDENT"
        ? STUDENT_ITEMS
        : ADMIN_ITEMS;
  const home = role === "ADMIN" ? "/admin/avis" : "/dashboard";

  // Sur mobile la rangée défile et les derniers items sont hors champ : on amène
  // l'item courant dans le champ pour qu'il ne soit jamais souligné « nulle part ».
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pathname]);

  const isActive = (item: Item) =>
    item.exact
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(`${item.href}/`);

  const renderItem = (item: Item) => {
    const Icon = item.icon;
    const active = isActive(item);
    const badge = badges[item.href] ?? 0;

    return (
      <Link
        key={item.href}
        ref={active ? activeRef : undefined}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          ITEM_CLASS,
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
  };

  return (
    <aside className="flex flex-col border-b border-border lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r">
      {/* Marque + compte (le compte n'apparaît ici que sur mobile). */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 lg:py-4">
        <Link href={home} className="flex items-center gap-2 font-semibold">
          <Music4 className="h-5 w-5 text-primary" />
          SiNote
        </Link>
        <div className="lg:hidden">
          <UserNav role={role} user={user} />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex gap-1 overflow-x-auto px-4 pb-2 lg:flex-1 lg:flex-col lg:gap-0.5 lg:overflow-x-visible lg:overflow-y-auto lg:px-3 lg:pb-2">
        {items.map(renderItem)}

        {role !== "ADMIN" ? (
          <>
            <span
              aria-hidden
              className="hidden h-px shrink-0 bg-border lg:my-2 lg:block"
            />
            <Link
              href="/profs"
              className={cn(
                ITEM_CLASS,
                "text-muted hover:bg-surface hover:text-foreground"
              )}
            >
              <Search className="h-4 w-4 shrink-0" />
              <span className="lg:flex-1">Trouver un prof</span>
            </Link>
          </>
        ) : null}
      </nav>

      {/* Compte, en pied de sidebar sur grand écran. Toute la rangée (avatar,
          nom, e-mail) ouvre le menu, pas seulement l'avatar. */}
      <div className="hidden border-t border-border p-2 lg:block">
        <UserNav role={role} user={user} showDetails />
      </div>
    </aside>
  );
}
