import Link from "next/link";
import {
  CalendarCheck,
  Music,
  Search,
  Sparkles,
  Wallet,
} from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import prisma from "@/lib/prisma";
import { visibleTeacherWhere } from "@/lib/teacher/visibility";

/**
 * Page d'accueil.
 *
 * Server Component : c'est la porte d'entrée du trafic de recherche, elle doit
 * être lisible sans JavaScript. Elle n'est plus l'écran de connexion — celui-ci
 * vit désormais sur /connexion.
 *
 * Les instruments et les villes affichés viennent de la base et ne listent que
 * ce qui est réellement enseigné : des liens vers des recherches vides
 * feraient fuir autant les visiteurs que les moteurs.
 */

const STEPS = [
  {
    icon: Search,
    title: "Trouvez un prof",
    text: "Filtrez par instrument, par ville, ou cherchez un cours en visio.",
  },
  {
    icon: CalendarCheck,
    title: "Choisissez un créneau",
    text: "Vous voyez ses disponibilités réelles et vous envoyez une demande.",
  },
  {
    icon: Music,
    title: "Prenez votre cours",
    text: "Le prof confirme, vous convenez des détails, et c'est parti.",
  },
];

export default async function HomePage() {
  const where = visibleTeacherWhere(new Date());

  const [instruments, cities, teacherCount] = await Promise.all([
    // Instruments effectivement enseignés, les plus représentés d'abord.
    prisma.instrument.findMany({
      where: { teachers: { some: { teacher: where } } },
      select: {
        slug: true,
        name: true,
        _count: { select: { teachers: true } },
      },
      orderBy: { teachers: { _count: "desc" } },
      take: 12,
    }),
    prisma.teacherProfile.groupBy({
      by: ["city"],
      where: { ...where, city: { not: null } },
      _count: { city: true },
      orderBy: { _count: { city: "desc" } },
      take: 8,
    }),
    prisma.teacherProfile.count({ where }),
  ]);

  return (
    <>
      <SiteHeader />

      <main>
        {/* Accroche */}
        <section className="mx-auto max-w-5xl px-4 py-20 text-center">
          <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Apprenez la musique avec un prof qui vous correspond
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
            Chant, piano, guitare, batterie… Consultez les disponibilités réelles
            des profs et réservez votre cours en quelques clics. Vous réglez
            votre prof directement : Noteva ne prend aucune commission.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="/profs">
                <Search className="mr-2 h-4 w-4" />
                Trouver un prof
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/connexion">Je suis professeur</Link>
            </Button>
          </div>

          {teacherCount > 0 ? (
            <p className="mt-6 text-sm text-zinc-500">
              {`${teacherCount} prof${teacherCount > 1 ? "s" : ""} ${teacherCount > 1 ? "disponibles" : "disponible"} en ce moment`}
            </p>
          ) : null}
        </section>

        {/* Instruments — liens explorables vers les recherches filtrées */}
        {instruments.length > 0 ? (
          <section className="mx-auto max-w-5xl px-4 pb-16">
            <h2 className="mb-6 text-xl font-medium">Par instrument</h2>
            <ul className="flex flex-wrap gap-2">
              {instruments.map((instrument) => (
                <li key={instrument.slug}>
                  <Link
                    href={`/profs?instrument=${instrument.slug}`}
                    className="flex items-center gap-2 rounded-full border border-zinc-200 px-4 py-2 text-sm transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
                  >
                    {instrument.name}
                    <span className="text-xs text-zinc-400">
                      {instrument._count.teachers}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Villes */}
        {cities.length > 0 ? (
          <section className="mx-auto max-w-5xl px-4 pb-16">
            <h2 className="mb-6 text-xl font-medium">Par ville</h2>
            <ul className="flex flex-wrap gap-2">
              {cities.map((row) => (
                <li key={row.city}>
                  <Link
                    href={`/profs?ville=${encodeURIComponent(row.city!)}`}
                    className="flex items-center gap-2 rounded-full border border-zinc-200 px-4 py-2 text-sm transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
                  >
                    {row.city}
                    <span className="text-xs text-zinc-400">
                      {row._count.city}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Fonctionnement */}
        <section className="border-y border-zinc-200 bg-zinc-50 py-16 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="mb-8 text-center text-2xl font-medium">
              Comment ça marche
            </h2>
            <ol className="grid gap-6 md:grid-cols-3">
              {STEPS.map((step, index) => {
                const Icon = step.icon;

                return (
                  <li key={step.title}>
                    <Card className="h-full">
                      <CardHeader>
                        <div className="mb-2 flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
                            {index + 1}
                          </span>
                          <Icon className="h-5 w-5 text-zinc-400" />
                        </div>
                        <CardTitle className="text-lg">{step.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                          {step.text}
                        </p>
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ol>

            <p className="mx-auto mt-8 flex max-w-2xl items-center justify-center gap-2 text-center text-sm text-zinc-500">
              <Wallet className="h-4 w-4 shrink-0" />
              Le paiement des cours se fait directement entre vous et votre
              prof, hors plateforme.
            </p>
          </div>
        </section>

        {/* Côté prof */}
        <section className="mx-auto max-w-5xl px-4 py-16">
          <Card>
            <CardHeader>
              <Badge variant="secondary" className="w-fit">
                <Sparkles className="mr-1 h-3 w-3" />
                Vous enseignez ?
              </Badge>
              <CardTitle className="text-2xl">
                Remplissez votre agenda, gardez vos tarifs
              </CardTitle>
              <CardDescription>
                Publiez votre fiche, définissez vos disponibilités récurrentes et
                recevez des demandes de cours. Un abonnement mensuel, et aucune
                commission sur ce que vous facturez.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/connexion">Créer ma fiche</Link>
              </Button>
            </CardContent>
          </Card>
        </section>

        <footer className="border-t border-zinc-200 py-8 dark:border-zinc-800">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 text-sm text-zinc-500">
            <span>Noteva</span>
            {/* Pas de lien de connexion ici : l'en-tête l'affiche déjà, et
                selon l'état de session. Le dupliquer proposerait « Se
                connecter » à quelqu'un qui l'est déjà. */}
            <nav className="flex gap-4">
              <Link href="/profs" className="hover:underline">
                Trouver un prof
              </Link>
            </nav>
          </div>
        </footer>
      </main>
    </>
  );
}
