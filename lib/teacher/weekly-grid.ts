import { normalize } from "@/lib/availability/intervals";

/**
 * Normalisation de la grille hebdomadaire saisie par le prof.
 *
 * L'éditeur laisse ajouter des plages librement ; on ne veut pas d'un
 * formulaire qui refuse « 9h-12h » puis « 11h-14h » alors que l'intention est
 * claire. On fusionne donc plutôt que d'invalider, et on ne refuse que ce qui
 * n'a aucun sens : borne inversée, hors de la journée, jour inexistant.
 *
 * Le moteur de créneaux fusionnerait de toute façon à la lecture ; le faire à
 * l'écriture évite d'accumuler des doublons en base et rend l'agenda du prof
 * conforme à ce qu'il a saisi.
 */

export type GridSlot = {
  /** ISO-8601 : 1 = lundi … 7 = dimanche. */
  weekday: number;
  /** Minutes depuis minuit, heure locale du prof. */
  startMinute: number;
  endMinute: number;
};

export type GridError = { index: number; message: string };

export type GridResult =
  | { ok: true; slots: GridSlot[] }
  | { ok: false; errors: GridError[] };

const MINUTES_PER_DAY = 1440;

export function normalizeWeeklyGrid(input: GridSlot[]): GridResult {
  const errors: GridError[] = [];

  input.forEach((slot, index) => {
    if (!Number.isInteger(slot.weekday) || slot.weekday < 1 || slot.weekday > 7) {
      errors.push({ index, message: "Jour de la semaine invalide" });
      return;
    }

    if (
      !Number.isInteger(slot.startMinute) ||
      !Number.isInteger(slot.endMinute) ||
      slot.startMinute < 0 ||
      slot.endMinute > MINUTES_PER_DAY
    ) {
      errors.push({ index, message: "Horaire hors de la journée" });
      return;
    }

    if (slot.startMinute >= slot.endMinute) {
      errors.push({
        index,
        message: "L'heure de fin doit suivre l'heure de début",
      });
    }
  });

  if (errors.length > 0) return { ok: false, errors };

  const slots: GridSlot[] = [];

  for (let weekday = 1; weekday <= 7; weekday++) {
    const merged = normalize(
      input
        .filter((slot) => slot.weekday === weekday)
        .map((slot) => ({ start: slot.startMinute, end: slot.endMinute }))
    );

    for (const interval of merged) {
      slots.push({
        weekday,
        startMinute: interval.start,
        endMinute: interval.end,
      });
    }
  }

  return { ok: true, slots };
}

/** "09:30" -> 570. Rend null sur une saisie inexploitable. */
export function parseTime(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());

  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 24 || minutes > 59) return null;

  const total = hours * 60 + minutes;

  return total > MINUTES_PER_DAY ? null : total;
}

/** 570 -> "09:30". 1440 rend "24:00", borne de fin de journée. */
export function formatTime(minute: number): string {
  const hours = Math.floor(minute / 60);
  const minutes = minute % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export const WEEKDAY_LABELS: Record<number, string> = {
  1: "Lundi",
  2: "Mardi",
  3: "Mercredi",
  4: "Jeudi",
  5: "Vendredi",
  6: "Samedi",
  7: "Dimanche",
};
