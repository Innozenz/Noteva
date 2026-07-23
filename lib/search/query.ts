/**
 * Analyse des filtres de recherche.
 *
 * Les filtres vivent dans l'URL, pas dans un état React : chaque combinaison
 * devient une adresse partageable et indexable, ce qui est exactement ce dont
 * vit une marketplace. Cette normalisation est donc aussi ce qui garantit
 * qu'une même recherche n'existe pas sous dix URLs différentes.
 */

export type LessonMode = "online" | "in_person";

export type SearchFilters = {
  /** Slug d'instrument, ou terme libre à faire correspondre aux alias. */
  instrument: string | null;
  city: string | null;
  mode: LessonMode | null;
  maxRateCents: number | null;
  trialOnly: boolean;
  page: number;
};

export type RawParams = Record<string, string | string[] | undefined>;

const PAGE_SIZE = 12;

export function parseFilters(params: RawParams): SearchFilters {
  return {
    instrument: cleanText(first(params.instrument)),
    city: cleanText(first(params.ville)),
    mode: parseMode(first(params.mode)),
    maxRateCents: parseRate(first(params.prix)),
    trialOnly: first(params.essai) === "1",
    page: parsePage(first(params.page)),
  };
}

/**
 * Reconstruit une query string canonique : les valeurs par défaut sont omises
 * pour qu'une recherche n'ait qu'une seule adresse possible.
 */
export function buildQueryString(filters: Partial<SearchFilters>): string {
  const params = new URLSearchParams();

  if (filters.instrument) params.set("instrument", filters.instrument);
  if (filters.city) params.set("ville", filters.city);
  if (filters.mode) params.set("mode", filters.mode);
  if (filters.maxRateCents) params.set("prix", String(filters.maxRateCents / 100));
  if (filters.trialOnly) params.set("essai", "1");
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));

  const query = params.toString();

  return query ? `?${query}` : "";
}

export function isDefaultSearch(filters: SearchFilters): boolean {
  return (
    filters.instrument === null &&
    filters.city === null &&
    filters.mode === null &&
    filters.maxRateCents === null &&
    !filters.trialOnly
  );
}

/**
 * Une page de recherche mérite-t-elle d'être indexée ?
 *
 * Instrument et ville sont les axes qui portent la valeur : « cours de chant à
 * Lyon » est exactement ce qu'un élève tape dans un moteur, et ces pages sont
 * peu nombreuses. Les autres filtres — prix, modalité, essai — multiplient les
 * combinaisons sans rien apporter à un visiteur venu d'un moteur, et diluent
 * le référencement en pages quasi identiques. La pagination non plus n'a pas à
 * être indexée : seule la première page l'est.
 */
export function isIndexableSearch(filters: SearchFilters): boolean {
  return (
    filters.mode === null &&
    filters.maxRateCents === null &&
    !filters.trialOnly &&
    filters.page === 1
  );
}

/**
 * L'élève a-t-il restreint quoi que ce soit ?
 *
 * Sert à distinguer deux situations que zéro résultat confond, et qui appellent
 * des réponses opposées : une recherche filtrée qui ne trouve rien se corrige
 * en élargissant, tandis qu'une recherche **sans aucun filtre** qui ne trouve
 * rien signifie que la plateforme est vide — conseiller alors d'« élargir la
 * recherche » revient à reprocher à l'élève une pénurie d'offre.
 *
 * La pagination est exclue : la page 2 d'une recherche sans filtre reste une
 * recherche sans filtre.
 */
export function hasActiveFilters(filters: SearchFilters): boolean {
  return (
    filters.instrument !== null ||
    filters.city !== null ||
    filters.mode !== null ||
    filters.maxRateCents !== null ||
    filters.trialOnly
  );
}

export const SEARCH_PAGE_SIZE = PAGE_SIZE;

export function pageOffset(page: number): number {
  return (page - 1) * PAGE_SIZE;
}

/**
 * Normalise un terme pour la comparaison aux alias : minuscules, sans
 * diacritiques. « Guitare Électrique » et « guitare electrique » doivent
 * ramener la même chose.
 */
export function normalizeTerm(term: string): string {
  return term
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function cleanText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 80) : null;
}

function parseMode(value: string | undefined): LessonMode | null {
  return value === "online" || value === "in_person" ? value : null;
}

function parseRate(value: string | undefined): number | null {
  if (!value) return null;

  const euros = Number(value);

  if (!Number.isFinite(euros) || euros <= 0) return null;

  return Math.round(Math.min(euros, 1000) * 100);
}

function parsePage(value: string | undefined): number {
  const page = Number(value);

  if (!Number.isInteger(page) || page < 1) return 1;

  // Borne dure : au-delà, la pagination profonde coûte cher pour rien.
  return Math.min(page, 100);
}
