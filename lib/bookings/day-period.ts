import { civilDateKeyInZone, localMinutesInZone } from "@/lib/availability/zone";

/**
 * Découpage d'une journée de créneaux en matin / après-midi / soir.
 *
 * Une colonne de vingt créneaux à la file ne se lit pas : l'élève cherche « un
 * cours après le travail » ou « un créneau avant l'école », c'est-à-dire une
 * plage, pas une heure. Nommer les plages lui évite de balayer la liste.
 *
 * **L'heure est lue dans le fuseau du prof**, comme partout ailleurs dans
 * l'application, et via `localMinutesInZone` — donc à l'horloge, jamais par
 * soustraction. Deux raisons, et la seconde est invisible à l'œil :
 *
 * - un élève à Montréal qui regarde un prof à Paris doit voir « Soir » sur le
 *   créneau que le prof appelle le soir, pas sur celui qui tombe le soir chez
 *   lui ;
 * - les deux jours de changement d'heure, la journée dure 23 ou 25 heures
 *   réelles, et une soustraction placerait un créneau de 12h05 au matin.
 *
 * Module pur : `startsAt` est fourni par l'appelant, rien n'est lu en base et
 * l'horloge n'est jamais consultée.
 */

export type DayPeriod = "MORNING" | "AFTERNOON" | "EVENING";

/** Frontières, en minutes depuis minuit local. */
export const AFTERNOON_FROM = 12 * 60;
export const EVENING_FROM = 18 * 60;

export const PERIOD_LABELS: Record<DayPeriod, string> = {
  MORNING: "Matin",
  AFTERNOON: "Après-midi",
  EVENING: "Soir",
};

/** Ordre d'affichage — celui de la journée, évidemment. */
export const PERIOD_ORDER: DayPeriod[] = ["MORNING", "AFTERNOON", "EVENING"];

export type PeriodGroup<T> = { period: DayPeriod; slots: T[] };

export type SlotDay<T> = {
  /** Date civile AAAA-MM-JJ, dans le fuseau du prof. */
  date: string;
  periods: PeriodGroup<T>[];
};

/** Plage à laquelle appartient un instant, vu du fuseau du prof. */
export function periodOf(instant: Date, timezone: string): DayPeriod {
  const minutes = localMinutesInZone(instant, timezone);

  if (minutes < AFTERNOON_FROM) return "MORNING";
  if (minutes < EVENING_FROM) return "AFTERNOON";
  return "EVENING";
}

/**
 * Regroupe des créneaux par jour civil puis par plage.
 *
 * Les jours sortent dans l'ordre d'arrivée — l'API les rend déjà triés — et les
 * plages dans l'ordre de la journée. **Une plage sans créneau n'est pas rendue**
 * : afficher « Après-midi » suivi de rien ferait passer un prof qui n'enseigne
 * que le matin pour un prof complet.
 */
export function groupSlotsByPeriod<T>(
  slots: T[],
  startsAt: (slot: T) => Date,
  timezone: string
): SlotDay<T>[] {
  const days = new Map<string, Map<DayPeriod, T[]>>();

  for (const slot of slots) {
    const instant = startsAt(slot);
    const date = civilDateKeyInZone(instant, timezone);

    let periods = days.get(date);
    if (!periods) {
      periods = new Map();
      days.set(date, periods);
    }

    const period = periodOf(instant, timezone);
    periods.set(period, [...(periods.get(period) ?? []), slot]);
  }

  return [...days.entries()].map(([date, periods]) => ({
    date,
    periods: PERIOD_ORDER.filter((period) => periods.has(period)).map(
      (period) => ({ period, slots: periods.get(period)! })
    ),
  }));
}
