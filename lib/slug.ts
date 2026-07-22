/**
 * Fabrication des slugs de fiches profs (`/profs/[slug]`).
 *
 * Fonction pure, testée à part : les noms français sont pleins d'accents, de
 * traits d'union et d'apostrophes, et un slug bancal se retrouve dans une URL
 * publique et indexée — donc difficile à corriger après coup.
 */

const MAX_LENGTH = 60;

/**
 * Segments qui entreraient en conflit avec des routes existantes ou futures,
 * ou qui feraient une URL trompeuse.
 */
const RESERVED = new Set([
  "api",
  "admin",
  "dashboard",
  "login",
  "register",
  "onboarding",
  "profs",
  "recherche",
  "new",
  "edit",
]);

export function slugify(input: string): string {
  const slug = input
    .normalize("NFD")
    // Retire les diacritiques : « Élodie Dupré » -> « Elodie Dupre ».
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    // Tout ce qui n'est ni lettre ni chiffre devient une césure.
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_LENGTH)
    .replace(/-+$/g, "");

  return slug;
}

/**
 * Slug libre à partir d'une base, en consultant les slugs déjà pris.
 *
 * `isTaken` est injecté plutôt qu'une requête Prisma : la logique de
 * numérotation reste testable sans base.
 */
export async function uniqueSlug(
  base: string,
  isTaken: (candidate: string) => Promise<boolean>,
  fallback = "prof"
): Promise<string> {
  const root = slugify(base) || fallback;
  const safeRoot = RESERVED.has(root) ? `${root}-${fallback}` : root;

  if (!(await isTaken(safeRoot))) return safeRoot;

  // Deux profs peuvent légitimement porter le même nom.
  for (let suffix = 2; suffix <= 50; suffix++) {
    const candidate = `${safeRoot}-${suffix}`;
    if (!(await isTaken(candidate))) return candidate;
  }

  // Au-delà, on cesse de compter : un identifiant court suffit à départager.
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = `${safeRoot}-${Math.random().toString(36).slice(2, 8)}`;
    if (!(await isTaken(candidate))) return candidate;
  }

  throw new Error("Impossible de générer un slug libre");
}

export const RESERVED_SLUGS = RESERVED;
