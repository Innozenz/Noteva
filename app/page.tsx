import type { CSSProperties } from "react";
import Link from "next/link";
import type { InstrumentFamily } from "@prisma/client";
import { ArrowUpRight, Search } from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { Spotlight } from "@/components/spotlight";
import { Button } from "@/components/ui/button";
import prisma from "@/lib/prisma";
import {
  FAMILY_LABELS,
  FAMILY_ORDER,
  FAMILY_STYLES,
} from "@/lib/instruments/family";
import { buildScore } from "@/lib/instruments/score";
import { visibleTeacherWhere } from "@/lib/teacher/visibility";
import { cn } from "@/lib/utils";

/**
 * Page d'accueil.
 *
 * Server Component : c'est la porte d'entrée du trafic de recherche, elle doit
 * être lisible sans JavaScript. Elle n'est plus l'écran de connexion — celui-ci
 * vit désormais sur /connexion.
 *
 * Parti pris graphique : **la portée structure la page, le séquenceur l'anime**.
 * Cinq lignes en filet ouvrent l'accroche et reviennent en négatif sur le bloc
 * prof ; une tête de lecture les balaie en boucle et allume chaque note à son
 * passage. Tout est en CSS (`globals.css`, section « Mouvement ») : rien à
 * charger, rien à hydrater, et la page reste entièrement rendue par le serveur.
 * Le seul îlot client est `Spotlight`, parce qu'aucune feuille de style ne sait
 * où se trouve le curseur.
 *
 * La couleur ne décore pas, elle **nomme une famille d'instruments** (voir
 * `lib/instruments/family.ts`). Les notes posées sur la portée sont exactement
 * les familles du répertoire plus bas : le lecteur apprend la correspondance en
 * descendant la page, sans légende.
 *
 * Les instruments et les villes affichés viennent de la base et ne listent que
 * ce qui est réellement enseigné : des liens vers des recherches vides
 * feraient fuir autant les visiteurs que les moteurs.
 */

/**
 * Géométrie de la portée. L'interligne vaut `STAFF_GAP`, donc un demi-interligne
 * — le pas réel des hauteurs de notes — vaut la moitié.
 *
 * La hauteur est calculée pour rendre **exactement cinq lignes** : le dégradé se
 * répète tous les `STAFF_GAP` px, une boîte de `4 × GAP + 1` en montre donc cinq
 * et pas six.
 */
const STAFF_GAP = 14;
const STAFF_HEIGHT = STAFF_GAP * 4 + 1;
const STAFF_STEP = STAFF_GAP / 2;

/** Tête de note, hampe et ligature — les proportions de la gravure. */
const NOTE_WIDTH = 12;
const NOTE_HEIGHT = 9;
const STEM_OFFSET = NOTE_WIDTH / 2 - 1;
const BEAM_THICKNESS = 4;

/**
 * Durée d'un aller de la tête de lecture.
 *
 * Assez lent pour être une respiration et non un clignotant : au-delà d'une
 * poignée de secondes, l'œil cesse de suivre et l'effet devient un fond.
 */
const SEQUENCE_SECONDS = 7;

/** Dégradés en style inline : en classe arbitraire, Tailwind découpe la valeur
    aux virgules et croit y voir des utilitaires. */
const staffLines = (color: string) =>
  `repeating-linear-gradient(to bottom, ${color} 0, ${color} 1px, transparent 1px, transparent ${STAFF_GAP}px)`;

const STEPS = [
  {
    title: "Trouvez un prof",
    text: "Filtrez par instrument, par ville, ou cherchez un cours en visio.",
  },
  {
    title: "Choisissez un créneau",
    text: "Vous voyez ses disponibilités réelles et vous envoyez une demande.",
  },
  {
    title: "Prenez votre cours",
    text: "Le prof confirme, vous convenez des détails, et c'est parti.",
  },
];

/** « 1 professeur », « 3 professeurs » — le pluriel se voit tout de suite. */
function count(n: number, singular: string, plural = `${singular}s`) {
  return `${n} ${n > 1 ? plural : singular}`;
}

/** Entrée décalée : les éléments arrivent dans l'ordre de lecture. */
const rise = (delay: number): CSSProperties => ({ animationDelay: `${delay}s` });

/**
 * Décalage d'apparition au défilement.
 *
 * Sur une ligne de temps `view()`, `animation-delay` ne veut plus rien dire —
 * l'avancement suit la position, pas l'horloge. Le décalage se fait donc en
 * repoussant la **plage**, ce qui est ce que lisent les variables déclarées
 * dans `globals.css`.
 */
const reveal = (index: number): CSSProperties =>
  ({
    "--reveal-from": `${index * 6}%`,
    "--reveal-to": `${60 + index * 6}%`,
  }) as CSSProperties;

export default async function HomePage() {
  const where = visibleTeacherWhere(new Date());

  const [instruments, cities, teacherCount] = await Promise.all([
    // Instruments effectivement enseignés, les plus représentés d'abord. La
    // limite dépasse le catalogue : le compteur affiché serait faux si la
    // requête tronquait.
    prisma.instrument.findMany({
      where: { teachers: { some: { teacher: where } } },
      select: {
        slug: true,
        name: true,
        family: true,
        _count: { select: { teachers: true } },
      },
      orderBy: { teachers: { _count: "desc" } },
      take: 60,
    }),
    prisma.teacherProfile.groupBy({
      by: ["city"],
      where: { ...where, city: { not: null } },
      _count: { city: true },
      orderBy: { _count: { city: "desc" } },
      take: 12,
    }),
    prisma.teacherProfile.count({ where }),
  ]);

  // Regroupement par famille, dans l'ordre du répertoire et non dans celui de
  // la requête : à l'intérieur d'une famille, le plus enseigné reste devant.
  const families = FAMILY_ORDER.map((family) => ({
    family,
    items: instruments.filter((instrument) => instrument.family === family),
  })).filter((group) => group.items.length > 0);

  const tally = [
    teacherCount > 0 ? count(teacherCount, "professeur") : null,
    instruments.length > 0 ? count(instruments.length, "instrument") : null,
    cities.length > 0 ? count(cities.length, "ville") : null,
  ].filter(Boolean);

  return (
    <>
      <SiteHeader />

      <main>
        {/* Accroche */}
        <section className="relative overflow-hidden">
          {/* Aurores.
              Elles ne nomment rien — c'est de la lumière, pas un code couleur.
              Elles restent donc sous le seuil où l'œil lit une teinte comme une
              information, sans quoi elles entreraient en concurrence avec les
              couleurs de familles, qui, elles, veulent dire quelque chose. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-hidden"
          >
            <div
              className="m-drift-a absolute -left-40 -top-56 h-[38rem] w-[38rem] rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgb(45 118 91 / 0.16), transparent 65%)",
              }}
            />
            <div
              className="m-drift-b absolute -right-40 -top-24 h-[32rem] w-[32rem] rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgb(166 111 63 / 0.12), transparent 65%)",
              }}
            />
          </div>

          {/* Accroche centrée. Alignée à gauche, la colonne de titre laissait
              un tiers de la largeur vide à droite, et la portée qui la
              surplombe, elle, va d'un bord à l'autre : le déséquilibre se
              voyait. Centré, le bloc se cale sur la portée. */}
          <div className="relative mx-auto max-w-5xl px-4 pb-20 pt-14 text-center sm:pt-20">
            <Staff families={families.map((group) => group.family)} />

            {tally.length > 0 ? (
              <p
                /* Dégagement calculé, pas choisi à l'œil : une ligature
                   descendante peut plonger de six demi-interlignes sous la
                   dernière ligne, soit 41 px hors de la boîte de la portée. */
                className="m-rise mt-14 text-xs uppercase tracking-[0.22em] text-subtle"
                style={rise(0.05)}
              >
                {tally.join(" · ")}
              </p>
            ) : null}

            <h1 className="mt-5">
              {/* La taille est fluide, en style inline : `clamp()` contient des
                  virgules, et une valeur arbitraire Tailwind s'y découperait. */}
              <span
                className="block font-display font-extrabold uppercase leading-[0.86] tracking-[-0.04em]"
                style={{ fontSize: "clamp(2.75rem, 11vw, 7rem)" }}
              >
                {/* Chaque ligne monte de derrière son propre masque. Le
                    rembourrage bas laisse passer la jambe du « Q » de MUSIQUE,
                    que `overflow: hidden` trancherait net ; la marge négative
                    le reprend, donc la mise en page ne bouge pas. */}
                <span className="-mb-[0.16em] block overflow-hidden pb-[0.16em]">
                  <span className="m-unmask block" style={rise(0.1)}>
                    Apprenez
                  </span>
                </span>
                <span className="-mb-[0.16em] block overflow-hidden pb-[0.16em]">
                  <span className="m-unmask block" style={rise(0.2)}>
                    la musique
                  </span>
                </span>
              </span>

              {/* Écart généreux : la jambe du « Q » descend loin sous la ligne
                  de base, et venait toucher cette phrase. */}
              <span
                className="m-rise mt-10 block font-sans text-xl font-normal leading-snug tracking-normal text-muted sm:text-2xl"
                style={rise(0.45)}
              >
                avec un prof{" "}
                {/* Le rose reste l'emphase éditoriale, jamais une famille : il
                    n'apparaît qu'ici sur toute la page. */}
                <span className="relative whitespace-nowrap text-foreground">
                  qui vous ressemble
                  <svg
                    aria-hidden
                    viewBox="0 0 300 12"
                    className="absolute -bottom-1.5 left-0 h-3 w-full text-accent"
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
              </span>
            </h1>

            <p
              className="m-rise mx-auto mt-9 max-w-xl text-pretty leading-relaxed text-muted"
              style={rise(0.55)}
            >
              Chant, piano, guitare, batterie… Consultez les disponibilités
              réelles des profs et réservez en quelques clics. Vous réglez votre
              prof directement, sans commission.
            </p>

            <div
              className="m-rise mt-8 flex flex-wrap items-center justify-center gap-3"
              style={rise(0.65)}
            >
              <Button size="lg" asChild>
                <Link href="/profs">
                  <Search className="h-4 w-4" />
                  Trouver un prof
                </Link>
              </Button>
              <Button size="lg" variant="ghost" asChild>
                <Link href="/connexion">
                  Je suis professeur
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Répertoire. Une ligne par famille : c'est ce qui donne son sens à la
            couleur, et accessoirement ce qui rend les recherches indexables. */}
        {families.length > 0 ? (
          <section className="border-t border-border">
            <div className="mx-auto max-w-5xl px-4 py-16">
              <div className="m-reveal">
                <h2 className="text-3xl sm:text-4xl">Le répertoire</h2>
                <p className="mt-2 text-sm text-muted">
                  Uniquement ce qui est réellement enseigné aujourd’hui.
                </p>
              </div>

              <ul className="mt-10 divide-y divide-border border-y border-border">
                {families.map(({ family, items }, index) => (
                  <li
                    key={family}
                    className="m-reveal grid gap-4 py-6 sm:grid-cols-[11rem_1fr] sm:gap-8"
                    style={reveal(index)}
                  >
                    <h3 className="flex items-baseline gap-2.5 text-sm font-semibold uppercase tracking-[0.14em]">
                      <span
                        aria-hidden
                        className={cn(
                          "h-2 w-2 shrink-0 translate-y-px rounded-full",
                          FAMILY_STYLES[family].dot
                        )}
                      />
                      <span className={FAMILY_STYLES[family].text}>
                        {FAMILY_LABELS[family]}
                      </span>
                    </h3>

                    <ul className="flex flex-wrap gap-2">
                      {items.map((instrument) => (
                        <li key={instrument.slug}>
                          <Link
                            href={`/profs?instrument=${instrument.slug}`}
                            className={cn(
                              "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0",
                              FAMILY_STYLES[family].chip
                            )}
                          >
                            {instrument.name}
                            <span className="text-xs opacity-60">
                              {instrument._count.teachers}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>

              {cities.length > 0 ? (
                <div className="m-reveal mt-10">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-subtle">
                    Par ville
                  </h3>
                  {/* Liste courante plutôt que pastilles : la ville n'est pas
                      une famille, elle n'a donc pas de teinte à porter. */}
                  <p className="mt-3 text-lg leading-relaxed">
                    {cities.map((row, index) => (
                      <span key={row.city}>
                        {index > 0 ? (
                          <span aria-hidden className="text-border-strong">
                            {" · "}
                          </span>
                        ) : null}
                        <Link
                          href={`/profs?ville=${encodeURIComponent(row.city!)}`}
                          className="underline decoration-border-strong decoration-2 underline-offset-4 transition-colors hover:decoration-accent"
                        >
                          {row.city}
                        </Link>
                      </span>
                    ))}
                  </p>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* Fonctionnement. Trois mesures séparées par des barres : des filets
            font le même travail qu'une carte, sans la boîte. */}
        <section className="border-t border-border bg-surface">
          <div className="mx-auto max-w-5xl px-4 py-16">
            <h2 className="m-reveal text-3xl sm:text-4xl">Comment ça marche</h2>

            <ol className="mt-10 grid gap-px overflow-hidden rounded-[var(--radius)] border border-border bg-border sm:grid-cols-3">
              {STEPS.map((step, index) => (
                <li
                  key={step.title}
                  className="m-reveal bg-background p-7"
                  style={reveal(index)}
                >
                  <span
                    aria-hidden
                    className="block font-display text-5xl font-extrabold leading-none text-primary"
                  >
                    {index + 1}
                  </span>
                  <h3 className="mt-4 text-lg">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {step.text}
                  </p>
                </li>
              ))}
            </ol>

            <p className="m-reveal mt-8 text-sm text-muted">
              Le paiement des cours se fait directement entre vous et votre
              prof, hors plateforme — la plateforme ne prend aucune commission.
            </p>
          </div>
        </section>

        {/* Côté prof. Encre pleine : la page se referme sur un contraste franc
            plutôt que sur une énième carte claire. */}
        <section>
          <Spotlight className="relative overflow-hidden bg-foreground text-background">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 transition-opacity duration-500"
              style={{
                opacity: "var(--spot-opacity, 0)",
                background:
                  "radial-gradient(26rem 26rem at var(--spot-x, 50%) var(--spot-y, 50%), rgb(45 118 91 / 0.3), transparent 70%)",
              }}
            />

            <div aria-hidden className="absolute inset-x-0 top-0">
              <Staff
                line="rgb(255 255 255 / 0.28)"
                head="rgb(255 255 255 / 0.85)"
              />
            </div>

            <div className="relative mx-auto max-w-5xl px-4 py-20">
              <p className="text-xs uppercase tracking-[0.22em] text-white/45">
                Vous enseignez ?
              </p>
              {/* Pas de largeur maximale : elle reprenait la main sur le saut de
                  ligne explicite et laissait « agenda, » seul sur sa ligne. */}
              <h2
                className="mt-4 font-display font-extrabold uppercase leading-[0.92] tracking-[-0.03em]"
                style={{ fontSize: "clamp(1.875rem, 4.6vw, 3rem)" }}
              >
                Remplissez votre agenda,
                <br />
                gardez vos tarifs
              </h2>
              <p className="mt-6 max-w-xl leading-relaxed text-white/65">
                Publiez votre fiche, définissez vos disponibilités récurrentes
                et recevez des demandes de cours. Un abonnement mensuel, et
                aucune commission sur ce que vous facturez.
              </p>

              {/* Bouton en négatif écrit à la main : les variantes de `Button`
                  sont réglées pour un fond clair, aucune ne tient sur l'encre. */}
              <Link
                href="/connexion"
                className="mt-9 inline-flex h-12 items-center gap-2 rounded-[var(--radius-sm)] bg-background px-6 text-base font-medium text-foreground transition-all hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
              >
                Créer ma fiche
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </Spotlight>
        </section>

        <footer className="border-t border-border py-10">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 text-sm text-muted">
            <span className="font-display font-bold uppercase tracking-[0.14em] text-foreground">
              Noteva
            </span>
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

/**
 * Une vraie portée : clef, chiffrage, quatre mesures de croches ligaturées,
 * barres de mesure — et une tête de lecture qui les joue.
 *
 * La gravure vient de `lib/instruments/score.ts`, qui rend des fractions et des
 * demi-interlignes ; ici on ne fait que les multiplier par la géométrie.
 *
 * **Les notes restent les familles réellement enseignées**, la phrase se
 * remplissant en les reprenant et en les transposant de mesure en mesure. La
 * couleur continue donc de nommer quelque chose, et le répertoire plus bas en
 * reste la légende.
 *
 * **La synchronisation est un décalage négatif, pas un minuteur.** La tête et
 * les notes partagent la durée `--sequence` ; chaque note démarre son cycle
 * comme s'il avait déjà tourné, de quoi placer sa frappe pile sous la tête.
 * Aucune horloge, aucun JavaScript, et rien qui puisse dériver : les deux
 * animations lisent la même variable.
 *
 * La tête de lecture vit dans la **zone de musique** et non sur toute la
 * largeur : elle lit les notes, pas la clef. C'est aussi ce qui garde les
 * fractions de `buildScore` et le balayage dans le même repère.
 *
 * Purement décorative, donc `aria-hidden` : le lecteur d'écran n'a que faire
 * d'une phrase qui ne dit rien de plus que le répertoire juste en dessous.
 */
function Staff({
  families = [],
  line = "var(--border)",
  head = "var(--primary)",
  notation = "var(--muted)",
}: {
  families?: InstrumentFamily[];
  line?: string;
  head?: string;
  notation?: string;
}) {
  // Bornée à droite : une barre finale posée à 100 % tomberait pile sur le
  // bord et se ferait rogner.
  const score = buildScore(families, { from: 0, to: 0.985 });

  return (
    <div
      aria-hidden
      className="relative flex"
      style={
        {
          height: STAFF_HEIGHT,
          backgroundImage: staffLines(line),
          "--sequence": `${SEQUENCE_SECONDS}s`,
        } as CSSProperties
      }
    >
      {/* Clef et chiffrage n'existent que s'il y a quelque chose à jouer : une
          clef seule devant une portée vide annonce une phrase qui ne vient
          jamais. */}
      {score.notes.length > 0 ? (
        <div className="relative w-16 shrink-0 sm:w-20">
          <TrebleClef color={notation} />

          <div
            className="absolute inset-y-0 flex flex-col justify-center font-display text-[1.3rem] font-bold leading-[1.28]"
            style={{ left: 38, color: notation }}
          >
            <span>4</span>
            <span>4</span>
          </div>
        </div>
      ) : null}

      <div className="relative flex-1">
        {/* Le conteneur fait la largeur de la zone de musique : le translater
            de 100 % promène le trait d'un bout à l'autre sans jamais animer la
            mise en page ni avoir à connaître cette largeur. */}
        <div className="m-playhead pointer-events-none absolute inset-0">
          <span
            className="absolute -bottom-3 -top-3 left-0 w-px"
            style={{
              background: `linear-gradient(to bottom, transparent, ${head}, transparent)`,
              boxShadow: `0 0 12px 1px ${head}`,
            }}
          />
        </div>

        {score.barLines.map((at) => (
          <span
            key={`bar-${at}`}
            className="absolute top-0 w-px opacity-60"
            style={{
              left: `${at * 100}%`,
              height: STAFF_HEIGHT - 1,
              background: notation,
            }}
          />
        ))}

        {score.beams.map((beam) => (
          <span
            key={`beam-${beam.from}`}
            className="absolute"
            style={{
              left: `${beam.from * 100}%`,
              width: `${(beam.to - beam.from) * 100}%`,
              // La hampe part du flanc de la tête, pas de son centre.
              marginLeft: beam.stemUp ? STEM_OFFSET : -STEM_OFFSET - 1,
              top:
                beam.pitch * STAFF_STEP - (beam.stemUp ? 0 : BEAM_THICKNESS),
              height: BEAM_THICKNESS,
              background: notation,
            }}
          />
        ))}

        {score.notes.map((note, index) => {
          const noteY = note.pitch * STAFF_STEP;
          const beamY = score.beams[note.bar].pitch * STAFF_STEP;

          return (
            <span key={`note-${index}`}>
              <span
                className="absolute w-px"
                style={{
                  left: `${note.at * 100}%`,
                  marginLeft: note.stemUp ? STEM_OFFSET : -STEM_OFFSET - 1,
                  top: Math.min(noteY, beamY),
                  height: Math.abs(noteY - beamY),
                  background: notation,
                }}
              />

              <span
                className={cn(
                  "m-note absolute h-[9px] w-3 -rotate-[18deg] rounded-full",
                  FAMILY_STYLES[note.family].dot,
                  // La lueur de la frappe est un `box-shadow` en
                  // `currentColor` : sans la couleur de texte, elle serait
                  // noire.
                  FAMILY_STYLES[note.family].text
                )}
                style={{
                  left: `${note.at * 100}%`,
                  marginLeft: -NOTE_WIDTH / 2,
                  top: noteY - NOTE_HEIGHT / 2,
                  // La position de la note dans la mesure est aussi la fraction
                  // du cycle à laquelle la tête de lecture l'atteint.
                  animationDelay: `${-(1 - note.at) * SEQUENCE_SECONDS}s`,
                }}
              />
            </span>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Clef de sol, tracée d'un trait d'épaisseur constante.
 *
 * Monolinéaire volontairement : une clef gravée a un plein et un délié, ce qui
 * demande une forme pleine et non un tracé. À cette taille le modelé ne se
 * verrait pas, et un trait régulier s'accorde au reste de la page — les filets
 * de la portée en sont un aussi.
 *
 * Le repère est celui de la portée : `y = 0` est la ligne du haut, `y = 42` la
 * ligne de sol, autour de laquelle s'enroule la spirale. C'est ce qui la pose
 * juste sans réglage à la main.
 */
function TrebleClef({ color }: { color: string }) {
  return (
    <svg
      viewBox="0 -18 26 96"
      fill="none"
      stroke={color}
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="absolute"
      style={{ left: 6, top: -18, width: 26, height: 96 }}
    >
      <path
        d="M13 42C8 42 6 36 11 33C18 30 23 38 21 47C18 57 9 58 5 50C0 41 6 30 12 22C17 15 19 6 15 0C12 -4 8 0 8 7C8 16 12 28 14 42C16 56 16 66 11 70C6 73 2 69 4 64"
      />
    </svg>
  );
}
