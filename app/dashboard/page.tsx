import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  Inbox,
  Search,
  Star,
  UserCog,
} from "lucide-react";

import { PageHeader, Row, RowList } from "@/components/editorial";
import {
  TeacherVisibilityNotice,
  visibilityBlocker,
} from "@/components/teacher-visibility-notice";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { checkPublishable } from "@/lib/teacher/publishable";
import { isSubscriptionActive } from "@/lib/teacher/visibility";
import { givenName } from "@/lib/user/name";
import { cn } from "@/lib/utils";

/**
 * Aiguillage de l'espace connecté.
 *
 * Server Component, comme tout ce qui lit un rôle. La version précédente était
 * la démonstration du boilerplate : `"use client"`, framer-motion, une carte
 * « Profil » qui répétait le nom et l'e-mail, un bouton vert « S'abonner » et
 * un bouton rouge « Se déconnecter » — deux couleurs qui n'existent nulle part
 * ailleurs dans le système.
 *
 * Elle affichait surtout un état d'abonnement calculé par une route qui avait
 * dérivé de la règle unique : un prof abonné y lisait « Inactif » pendant que
 * son propre espace lui disait « Actif ». Le doublon disparaît ici ;
 * l'abonnement se gère à un seul endroit, /dashboard/prof/abonnement.
 */
export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) redirect("/connexion");

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: {
      name: true,
      firstName: true,
      role: true,
      teacherProfile: {
        select: {
          id: true,
          status: true,
          headline: true,
          bio: true,
          hourlyRateCents: true,
          teachesOnline: true,
          teachesInPerson: true,
          teachesAtHome: true,
          city: true,
          stripeCurrentPeriodEnd: true,
          _count: { select: { instruments: true, rules: true } },
        },
      },
    },
  });

  // Un administrateur n'a ni fiche prof ni cours : sans cette sortie il
  // tomberait dans la branche « élève » et lirait « Vos cours et votre profil
  // d'élève » au-dessus de cartes vides.
  if (user.role === "ADMIN") redirect("/admin/avis");

  const firstName = givenName(user);

  // Le compteur de demandes en attente est la seule donnée qui mérite d'être
  // ici : elle appelle une action, et chaque demande non traitée immobilise un
  // créneau.
  const pendingCount = user.teacherProfile
    ? await prisma.booking.count({
        where: {
          teacherId: user.teacherProfile.id,
          status: "PENDING",
          endsAt: { gt: new Date() },
        },
      })
    : 0;

  const isTeacher = user.role === "TEACHER";

  // Ce qui empêche la fiche d'être trouvée passe avant tout le reste : c'est
  // la seule chose à faire tant qu'elle n'est pas visible.
  const blocker = user.teacherProfile
    ? visibilityBlocker({
        publishable: checkPublishable({
          headline: user.teacherProfile.headline,
          bio: user.teacherProfile.bio,
          hourlyRateCents: user.teacherProfile.hourlyRateCents,
          teachesOnline: user.teacherProfile.teachesOnline,
          teachesInPerson: user.teacherProfile.teachesInPerson,
          teachesAtHome: user.teacherProfile.teachesAtHome,
          city: user.teacherProfile.city,
          instrumentCount: user.teacherProfile._count.instruments,
          availabilityRuleCount: user.teacherProfile._count.rules,
        }).ok,
        published: user.teacherProfile.status === "PUBLISHED",
        subscribed: isSubscriptionActive(
          user.teacherProfile.stripeCurrentPeriodEnd,
          new Date()
        ),
      })
    : null;

  const links = isTeacher
    ? [
        {
          href: "/dashboard/prof/demandes",
          icon: Inbox,
          title: "Demandes de cours",
          text:
            pendingCount > 0
              ? `${pendingCount} demande${pendingCount > 1 ? "s" : ""} en attente — chacune bloque son créneau.`
              : "Aucune demande en attente.",
          highlight: pendingCount > 0,
        },
        {
          href: "/dashboard/prof",
          icon: UserCog,
          title: "Ma fiche",
          text: "Présentation, instruments, tarif et règles de réservation.",
          highlight: false,
        },
        {
          href: "/dashboard/prof/disponibilites",
          icon: CalendarDays,
          title: "Mes disponibilités",
          text: "La semaine type et les exceptions ponctuelles.",
          highlight: false,
        },
        {
          href: "/dashboard/prof/avis",
          icon: Star,
          title: "Mes avis",
          text: "Ce que vos élèves ont écrit, et votre droit de réponse.",
          highlight: false,
        },
      ]
    : [
        {
          href: "/dashboard/cours",
          icon: CalendarDays,
          title: "Mes cours",
          text: "Demandes en cours, cours à venir et historique.",
          highlight: false,
        },
        {
          href: "/dashboard/cours/profil",
          icon: UserCog,
          title: "Mon profil",
          text: "Niveau, objectifs et contact du responsable si vous êtes mineur.",
          highlight: false,
        },
        {
          href: "/profs",
          icon: Search,
          title: "Trouver un prof",
          text: "Par instrument, par ville, ou en visio.",
          highlight: false,
        },
      ];

  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
      <PageHeader
        eyebrow={isTeacher ? "Espace professeur" : "Espace élève"}
        title={firstName ? `Bonjour ${firstName}` : "Bonjour"}
      />

      {blocker ? (
        <div className="mt-8">
          <TeacherVisibilityNotice blocker={blocker} />
        </div>
      ) : null}

      <RowList className="mt-10">
        {links.map((link) => {
          const Icon = link.icon;

          return (
            <Row
              key={link.href}
              href={link.href}
              main={
                <div className="flex items-start gap-3">
                  <Icon
                    className={cn(
                      "mt-1 h-5 w-5 shrink-0",
                      link.highlight ? "text-warning" : "text-subtle"
                    )}
                  />
                  <div>
                    <p className="font-display text-lg font-medium text-foreground">
                      {link.title}
                    </p>
                    <p
                      className={cn(
                        "mt-0.5 text-sm",
                        link.highlight ? "text-warning" : "text-muted"
                      )}
                    >
                      {link.text}
                    </p>
                  </div>
                </div>
              }
              meta={
                <ArrowRight className="mt-1 h-4 w-4 text-subtle transition-transform group-hover:translate-x-0.5" />
              }
            />
          );
        })}
      </RowList>

      {isTeacher ? (
        <div className="mt-8">
          <Button variant="outline" asChild>
            <Link href="/dashboard/prof/abonnement">
              Gérer mon abonnement
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      ) : null}
    </main>
  );
}
