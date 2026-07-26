import { TZDate } from "@date-fns/tz";

/**
 * Conversions « heure murale ↔ instant », dans le fuseau du prof.
 *
 * Extrait du moteur de créneaux pour que l'agenda hebdomadaire s'en serve
 * aussi : poser un cours dans une grille jour × heure, c'est exactement la même
 * conversion que projeter une règle « lundi 9h » sur une date. Deux
 * implémentations divergeraient au premier changement d'heure, et la divergence
 * ne se verrait que deux jours par an.
 */

export const MINUTES_PER_DAY = 1440;

/**
 * Instant correspondant à une heure murale dans un fuseau donné.
 *
 * `minute` peut valoir 1440 : minuit le lendemain, ce que le constructeur
 * normalise comme le fait `Date`.
 */
export function wallClockToInstant(
  dayKey: string,
  minute: number,
  timezone: string
): number {
  const [year, month, day] = dayKey.split("-").map(Number);

  return new TZDate(
    year,
    month - 1,
    day,
    Math.floor(minute / 60),
    minute % 60,
    0,
    0,
    timezone
  ).getTime();
}

/** Date civile d'un instant, lue dans un fuseau. */
export function civilDateKeyInZone(instant: Date, timezone: string): string {
  const zoned = new TZDate(instant.getTime(), timezone);
  return formatKey(zoned.getFullYear(), zoned.getMonth() + 1, zoned.getDate());
}

/**
 * Minutes depuis minuit local d'un instant, lues dans un fuseau.
 *
 * La lecture murale est obligatoire : soustraire l'instant de minuit local
 * donnerait une heure d'écart les deux jours de changement d'heure, où la
 * journée dure 23 ou 25 heures réelles pour 1440 minutes affichées. Un cours de
 * 14h se dessinerait alors à 13h sous une étiquette « 14:00 ».
 */
export function localMinutesInZone(instant: Date, timezone: string): number {
  const zoned = new TZDate(instant.getTime(), timezone);
  return zoned.getHours() * 60 + zoned.getMinutes();
}

/**
 * Date civile d'une colonne `@db.Date`. Prisma rend ces valeurs sous forme de
 * Date à minuit UTC : les lire en heure locale du serveur décalerait d'un jour
 * pour tout fuseau derrière UTC.
 */
export function civilDateKey(date: Date): string {
  return formatKey(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate()
  );
}

/** 1 = lundi … 7 = dimanche, calculé sur la date civile seule. */
export function isoWeekday(dayKey: string): number {
  const [year, month, day] = dayKey.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

/**
 * Décale une date civile de `days` jours.
 *
 * Arithmétique de calendrier pure, en UTC : aucun fuseau n'intervient, donc
 * aucun jour de 23 ou 25 heures ne peut fausser le compte.
 */
export function addDays(dayKey: string, days: number): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));

  return formatKey(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate()
  );
}

export function formatKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}