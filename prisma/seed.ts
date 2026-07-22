/**
 * Catalogue d'instruments.
 *
 * Idempotent : chaque entrée est upsertée sur son slug, on peut relancer le
 * seed sans dupliquer ni perdre les rattachements existants.
 *
 * Les `aliases` servent la recherche : ils couvrent les façons dont un élève
 * formule sa demande (« coaching vocal », « guitare sèche », « batterie »)
 * quand elles ne correspondent pas au nom canonique.
 */
import "dotenv/config";
import { PrismaClient, type InstrumentFamily } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL n'est pas défini (voir .env.example)");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

type InstrumentSeed = {
  slug: string;
  name: string;
  family: InstrumentFamily;
  aliases?: string[];
};

const INSTRUMENTS: InstrumentSeed[] = [
  // Voix
  {
    slug: "chant",
    name: "Chant",
    family: "VOICE",
    aliases: ["technique vocale", "coaching vocal", "cours de voix", "chanter"],
  },
  {
    slug: "chant-lyrique",
    name: "Chant lyrique",
    family: "VOICE",
    aliases: ["opéra", "classique", "bel canto"],
  },
  {
    slug: "chant-jazz",
    name: "Chant jazz",
    family: "VOICE",
    aliases: ["jazz vocal", "scat"],
  },
  {
    slug: "chant-musiques-actuelles",
    name: "Chant musiques actuelles",
    family: "VOICE",
    aliases: ["variété", "pop", "rock", "soul", "r&b"],
  },

  // Claviers
  {
    slug: "piano",
    name: "Piano",
    family: "KEYBOARD",
    aliases: ["piano classique", "piano jazz", "clavier"],
  },
  {
    slug: "orgue",
    name: "Orgue",
    family: "KEYBOARD",
    aliases: ["orgue liturgique", "orgue hammond"],
  },
  {
    slug: "clavecin",
    name: "Clavecin",
    family: "KEYBOARD",
    aliases: ["musique ancienne", "baroque"],
  },
  {
    slug: "accordeon",
    name: "Accordéon",
    family: "KEYBOARD",
    aliases: ["accordéon diatonique", "accordéon chromatique"],
  },

  // Cordes
  {
    slug: "guitare",
    name: "Guitare",
    family: "STRINGS",
    aliases: ["guitare sèche", "guitare acoustique", "guitare folk"],
  },
  {
    slug: "guitare-classique",
    name: "Guitare classique",
    family: "STRINGS",
    aliases: ["guitare espagnole", "guitare nylon"],
  },
  {
    slug: "guitare-electrique",
    name: "Guitare électrique",
    family: "STRINGS",
    aliases: ["électrique", "rock", "métal", "blues"],
  },
  {
    slug: "basse",
    name: "Basse",
    family: "STRINGS",
    aliases: ["basse électrique", "guitare basse"],
  },
  {
    slug: "contrebasse",
    name: "Contrebasse",
    family: "STRINGS",
    aliases: ["double bass"],
  },
  {
    slug: "violon",
    name: "Violon",
    family: "STRINGS",
    aliases: ["violon classique", "fiddle"],
  },
  { slug: "alto", name: "Alto", family: "STRINGS", aliases: ["viole"] },
  {
    slug: "violoncelle",
    name: "Violoncelle",
    family: "STRINGS",
    aliases: ["cello"],
  },
  { slug: "harpe", name: "Harpe", family: "STRINGS", aliases: ["harpe celtique"] },
  { slug: "ukulele", name: "Ukulélé", family: "STRINGS", aliases: ["uku"] },

  // Bois
  {
    slug: "flute-traversiere",
    name: "Flûte traversière",
    family: "WINDS",
    aliases: ["flûte"],
  },
  {
    slug: "flute-a-bec",
    name: "Flûte à bec",
    family: "WINDS",
    aliases: ["flûte douce"],
  },
  {
    slug: "clarinette",
    name: "Clarinette",
    family: "WINDS",
    aliases: ["clarinette basse"],
  },
  {
    slug: "saxophone",
    name: "Saxophone",
    family: "WINDS",
    aliases: ["sax", "saxo", "saxophone alto", "saxophone ténor"],
  },
  { slug: "hautbois", name: "Hautbois", family: "WINDS" },
  { slug: "basson", name: "Basson", family: "WINDS" },

  // Cuivres
  { slug: "trompette", name: "Trompette", family: "BRASS", aliases: ["cornet"] },
  { slug: "trombone", name: "Trombone", family: "BRASS", aliases: ["trombone à coulisse"] },
  { slug: "cor", name: "Cor", family: "BRASS", aliases: ["cor d'harmonie"] },
  { slug: "tuba", name: "Tuba", family: "BRASS", aliases: ["euphonium"] },

  // Percussions
  {
    slug: "batterie",
    name: "Batterie",
    family: "PERCUSSION",
    aliases: ["drums", "percussions", "drum"],
  },
  {
    slug: "percussions",
    name: "Percussions",
    family: "PERCUSSION",
    aliases: ["djembé", "cajón", "congas", "darbouka"],
  },
  {
    slug: "vibraphone",
    name: "Vibraphone",
    family: "PERCUSSION",
    aliases: ["marimba", "xylophone", "claviers à lames"],
  },

  // Électronique
  {
    slug: "mao",
    name: "MAO",
    family: "ELECTRONIC",
    aliases: [
      "musique assistée par ordinateur",
      "ableton",
      "logic",
      "fl studio",
      "production musicale",
      "beatmaking",
    ],
  },
  {
    slug: "dj",
    name: "DJ",
    family: "ELECTRONIC",
    aliases: ["mix", "platines", "turntablism"],
  },
  {
    slug: "synthetiseur",
    name: "Synthétiseur",
    family: "ELECTRONIC",
    aliases: ["synthé", "sound design"],
  },

  // Théorie
  {
    slug: "solfege",
    name: "Solfège",
    family: "THEORY",
    aliases: ["formation musicale", "lecture de notes", "théorie musicale"],
  },
  {
    slug: "harmonie",
    name: "Harmonie",
    family: "THEORY",
    aliases: ["harmonie jazz", "analyse", "arrangement"],
  },
  {
    slug: "composition",
    name: "Composition",
    family: "THEORY",
    aliases: ["écriture", "songwriting", "orchestration"],
  },
];

async function main() {
  for (const instrument of INSTRUMENTS) {
    await prisma.instrument.upsert({
      where: { slug: instrument.slug },
      create: {
        slug: instrument.slug,
        name: instrument.name,
        family: instrument.family,
        aliases: instrument.aliases ?? [],
      },
      update: {
        name: instrument.name,
        family: instrument.family,
        aliases: instrument.aliases ?? [],
      },
    });
  }

  const total = await prisma.instrument.count();
  console.log(`${INSTRUMENTS.length} instruments seedés (${total} en base).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
