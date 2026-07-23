"use client";

import { useRouter } from "next/navigation";
import { CalendarDays, CreditCard, LogOut, Star, UserCog } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";

/**
 * Menu du compte.
 *
 * C'est le seul endroit d'où l'on peut se déconnecter : le bouton rouge de
 * l'ancien tableau de bord de démonstration a disparu avec lui, et une
 * application dont on ne peut pas sortir n'est pas une application.
 *
 * Les entrées dépendent du rôle. Auparavant elles pointaient toutes deux vers
 * /dashboard, ce qui donnait un menu où « Abonnement » n'ouvrait pas
 * l'abonnement.
 */
export function UserNav({ role }: { role: "TEACHER" | "STUDENT" | "ADMIN" }) {
  const session = authClient.useSession();
  const router = useRouter();

  if (!session.data) return null;

  const user = session.data.user;
  const initials = user.name
    ? user.name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : user.email.charAt(0).toUpperCase();

  const items =
    role === "TEACHER"
      ? [
          { icon: UserCog, label: "Ma fiche", href: "/dashboard/prof" },
          { icon: Star, label: "Mes avis", href: "/dashboard/prof/avis" },
          {
            icon: CreditCard,
            label: "Abonnement",
            href: "/dashboard/prof/abonnement",
          },
        ]
      : [
          { icon: CalendarDays, label: "Mes cours", href: "/dashboard/cours" },
          {
            icon: UserCog,
            label: "Mon profil",
            href: "/dashboard/cours/profil",
          },
        ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
          <Avatar className="h-8 w-8">
            <AvatarImage
              src={user.image || undefined}
              alt={user.name || user.email}
            />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <span className="sr-only">Mon compte</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            {user.name ? (
              <p className="text-sm font-medium leading-none">{user.name}</p>
            ) : null}
            <p className="truncate text-xs leading-none text-muted">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          {items.map((item) => {
            const Icon = item.icon;

            return (
              <DropdownMenuItem
                key={item.href}
                onClick={() => router.push(item.href)}
              >
                <Icon className="mr-2 h-4 w-4" />
                <span>{item.label}</span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={async () => {
            await authClient.signOut();
            router.push("/");
            router.refresh();
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Se déconnecter</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
