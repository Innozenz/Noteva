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
        {/* Accroche. Le halo indigo/rose donne un point d'ancrage chaud sans
            image : rien à charger, et ça respire. */}
        <section className="relative overflow-hidden">
          {/* Dégradés posés en style inline : en classe arbitraire, Tailwind
              découpe la valeur aux virgules et croit y voir des utilitaires. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-40 h-[28rem] opacity-80"
            style={{
              background:
                "radial-gradient(60% 60% at 50% 50%, var(--primary-soft), transparent 70%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full"
            style={{
              background:
                "radial-gradient(circle, var(--accent-soft), transparent 70%)",
            }}
          />

          <div className="relative mx-auto max-w-4xl px-4 pb-16 pt-20 text-center sm:pt-28">
            {teacherCount > 0 ? (
              <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-elevated px-3 py-1 text-sm text-muted">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                </span>
                {`${teacherCount} prof${teacherCount > 1 ? "s" : ""} ${teacherCount > 1 ? "disponibles" : "disponible"} en ce moment`}
              </p>
            ) : null}

            <h1 className="text-balance text-4xl leading-[1.05] sm:text-6xl">
              Apprenez la musique avec un prof{" "}
              {/* Le rose n'apparaît qu'ici : rare, donc il porte. */}
              <span className="relative whitespace-nowrap text-primary">
                qui vous ressemble
                <svg
                  aria-hidden
                  viewBox="0 0 300 12"
                  className="absolute -bottom-1 left-0 h-3 w-full text-accent"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M2 8c60-6 120-6 180-2s80 4 116-2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </h1>

            <p className="mx-auto mt-7 max-w-xl text-pretty text-lg leading-relaxed text-muted">
              Chant, piano, guitare, batterie… Consultez les disponibilités
              réelles des profs et réservez en quelques clics. Vous réglez votre
              prof directement, sans commission.
            </p>

            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Button size="lg" asChild>
                <Link href="/profs">
                  <Search className="h-4 w-4" />
                  Trouver un prof
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/connexion">Je suis professeur</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Entrées de recherche. Regroupées : ce sont deux façons de faire la
            même chose, les séparer en deux sections les diluait. */}
        {instruments.length > 0 || cities.length > 0 ? (
          <section className="mx-auto max-w-5xl px-4 pb-20">
            <div className="grid gap-10 sm:grid-cols-[2fr_1fr]">
              {instruments.length > 0 ? (
                <div>
                  <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-subtle">
                    Par instrument
                  </h2>
                  <ul className="flex flex-wrap gap-2">
                    {instruments.map((instrument) => (
                      <li key={instrument.slug}>
                        <Link
                          href={`/profs?instrument=${instrument.slug}`}
                          className="group flex items-center gap-2 rounded-full border border-border bg-elevated px-4 py-2 text-sm transition-all hover:border-primary hover:text-primary"
                        >
                          {instrument.name}
                          <span className="rounded-full bg-surface px-1.5 text-xs text-subtle transition-colors group-hover:bg-primary-soft group-hover:text-primary">
                            {instrument._count.teachers}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {cities.length > 0 ? (
                <div>
                  <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-subtle">
                    Par ville
                  </h2>
                  <ul className="flex flex-wrap gap-2">
                    {cities.map((row) => (
                      <li key={row.city}>
                        <Link
                          href={`/profs?ville=${encodeURIComponent(row.city!)}`}
                          className="group flex items-center gap-2 rounded-full border border-border bg-elevated px-4 py-2 text-sm transition-all hover:border-primary hover:text-primary"
                        >
                          {row.city}
                          <span className="rounded-full bg-surface px-1.5 text-xs text-subtle transition-colors group-hover:bg-primary-soft group-hover:text-primary">
                            {row._count.city}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* Fonctionnement */}
        <section className="border-y border-border bg-surface py-16">
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
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
                            {index + 1}
                          </span>
                          <Icon className="h-5 w-5 text-subtle" />
                        </div>
                        <CardTitle className="text-lg">{step.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted">
                          {step.text}
                        </p>
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ol>

            <p className="mx-auto mt-8 flex max-w-2xl items-center justify-center gap-2 text-center text-sm text-muted">
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

        <footer className="border-t border-border py-8">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 text-sm text-muted">
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
