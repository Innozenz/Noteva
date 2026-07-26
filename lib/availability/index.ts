import { clamp, normalize, subtract, type Interval } from "./intervals";
import type {
  ExceptionInput,
  RuleInput,
  Slot,
  SlotEngineInput,
} from "./types";
import {
  civilDateKey,
  civilDateKeyInZone,
  isoWeekday,
  MINUTES_PER_DAY,
  wallClockToInstant,
} from "./zone";

export * from "./types";
export { type Interval } from "./intervals";

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/**
 * Calcule les créneaux réservables d'un prof sur une fenêtre donnée.
 *
 * Fonction pure : aucun accès base, aucune lecture de l'horloge (`now` est
 * fourni). Les disponibilités n'existent nulle part en base sous forme de
 * créneaux — elles sont dérivées ici, à chaque lecture, de
 * `règles − exceptions − occupations`.
 *
 * Le pivot du calcul est la conversion « heure murale → instant » : une règle
 * dit « lundi 9h » dans le fuseau du prof, et c'est seulement au moment de la
 * projeter sur une date précise qu'on obtient un instant. C'est ce qui fait
 * qu'un cours de 9h reste à 9h de part et d'autre du changement d'heure, alors
 * que son décalage UTC, lui, bouge.
 */
export function computeAvailableSlots(input: SlotEngineInput): Slot[] {
  const {
    timezone,
    rules,
    exceptions,
    busy,
    range,
    now,
    slotDurationMin,
    bufferMin = 0,
    minNoticeHours = 0,
    bookingHorizonDays,
    granularityMin,
  } = input;

  const step = granularityMin ?? slotDurationMin;

  if (slotDurationMin <= 0 || step <= 0) return [];

  // Fenêtre effective : l'intersection de la plage demandée, du préavis
  // minimum et de l'horizon de réservation.
  const windowStart = Math.max(
    range.from.getTime(),
    now.getTime() + minNoticeHours * HOUR_MS
  );

  let windowEnd = range.to.getTime();
  if (bookingHorizonDays != null) {
    windowEnd = Math.min(windowEnd, now.getTime() + bookingHorizonDays * DAY_MS);
  }

  if (windowEnd <= windowStart) return [];

  // 1. Ouvertures locales, jour civil par jour civil, projetées en instants.
  const open: Interval[] = [];

  for (const dayKey of enumerateLocalDays(range.from, range.to, timezone)) {
    for (const local of dayOpenings(dayKey, rules, exceptions).open) {
      open.push({
        start: wallClockToInstant(dayKey, local.start, timezone),
        end: wallClockToInstant(dayKey, local.end, timezone),
      });
    }
  }

  // 2. Retrait des occupations, élargies du battement de part et d'autre.
  const blocked: Interval[] = busy.map((b) => ({
    start: b.startsAt.getTime() - bufferMin * MINUTE_MS,
    end: b.endsAt.getTime() + bufferMin * MINUTE_MS,
  }));

  const free = clamp(subtract(open, blocked), {
    start: windowStart,
    end: windowEnd,
  });

  // 3. Découpage.
  //
  // La grille est ancrée sur les **ouvertures** du prof, pas sur les plages
  // libres. La différence n'est pas cosmétique :
  //
  // - Ancrée sur le libre, la grille dépend des réservations existantes et du
  //   préavis minimum — donc de `now`. Deux appels à une seconde d'intervalle
  //   peuvent rendre des départs différents, et un créneau affiché à l'élève
  //   devient irréservable entre son clic et l'arrivée de sa requête. C'est
  //   aussi ce qui décalait toute la journée du battement après la première
  //   réservation.
  // - Ancrée sur l'ouverture, la grille ne dépend que de ce que le prof a
  //   déclaré. Elle est donc reproductible, et le serveur peut vérifier qu'un
  //   départ demandé lui appartient — ce que la re-dérivation ne pouvait pas
  //   faire tant que la grille se déplaçait.
  //
  // Le pas s'applique en instants : sur un jour de changement d'heure, une
  // plage locale de 3h peut ne durer que 2h réelles, et le nombre de créneaux
  // suit.
  const durationMs = slotDurationMin * MINUTE_MS;
  const stepMs = step * MINUTE_MS;
  const slots: Slot[] = [];

  for (const opening of open) {
    for (let t = opening.start; t + durationMs <= opening.end; t += stepMs) {
      // Le créneau doit tenir **entièrement** dans une plage encore libre :
      // c'est là qu'interviennent les réservations, le battement, le préavis
      // et l'horizon, sans jamais déplacer la grille.
      const fits = free.some(
        (interval) => t >= interval.start && t + durationMs <= interval.end
      );

      if (fits) {
        slots.push({ startsAt: new Date(t), endsAt: new Date(t + durationMs) });
      }
    }
  }

  return slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

export type DayOpenings = {
  /** Ce qui est réellement ouvert ce jour-là. */
  open: Interval[];
  /**
   * Ce qu'une exception BLOCKED a retiré d'une plage par ailleurs ouverte.
   *
   * Le moteur de créneaux n'en a pas l'usage — il ne retient que le libre. Mais
   * l'agenda du prof, lui, doit distinguer « fermé exprès » de « jamais
   * ouvert » : un congé posé sur un mardi travaillé doit se voir, sinon la
   * journée ressemble à un oubli de saisie. Un BLOCKED sur un jour sans règle
   * ne rend donc rien : il n'a rien retiré.
   */
  closed: Interval[];
};

/**
 * Ouvertures d'une journée civile, en minutes depuis minuit local :
 * (règles hebdo ∪ exceptions EXTRA) − exceptions BLOCKED.
 */
export function dayOpenings(
  dayKey: string,
  rules: RuleInput[],
  exceptions: ExceptionInput[]
): DayOpenings {
  const weekday = isoWeekday(dayKey);
  const todays = exceptions.filter((e) => civilDateKey(e.date) === dayKey);

  const base = rules
    .filter((r) => r.weekday === weekday && isRuleActiveOn(r, dayKey))
    .map((r) => ({ start: r.startMinute, end: r.endMinute }));

  const extra = todays
    .filter((e) => e.type === "EXTRA")
    .filter((e) => e.startMinute != null && e.endMinute != null)
    .map((e) => ({ start: e.startMinute!, end: e.endMinute! }));

  // Sans bornes, un BLOCKED couvre la journée entière.
  const blocked = todays
    .filter((e) => e.type === "BLOCKED")
    .map((e) =>
      e.startMinute == null || e.endMinute == null
        ? { start: 0, end: MINUTES_PER_DAY }
        : { start: e.startMinute, end: e.endMinute }
    );

  const declared = normalize([...base, ...extra]);
  const open = subtract(declared, blocked);

  return { open, closed: subtract(declared, open) };
}

function isRuleActiveOn(rule: RuleInput, dayKey: string): boolean {
  if (rule.validFrom && dayKey < civilDateKey(rule.validFrom)) return false;
  if (rule.validUntil && dayKey > civilDateKey(rule.validUntil)) return false;
  return true;
}

/**
 * Jours civils du fuseau du prof recouvrant la plage demandée, débordés d'un
 * jour de chaque côté : une plage d'instants peut commencer au milieu d'une
 * journée locale dont l'ouverture a débuté plus tôt.
 *
 * On avance par demi-journées et on déduplique plutôt que d'ajouter 24 h : les
 * jours de changement d'heure durent 23 ou 25 heures.
 */
function enumerateLocalDays(from: Date, to: Date, timezone: string): string[] {
  const start = from.getTime() - DAY_MS;
  const end = to.getTime() + DAY_MS;
  const keys = new Set<string>();

  for (let t = start; t <= end; t += DAY_MS / 2) {
    keys.add(civilDateKeyInZone(new Date(t), timezone));
  }
  keys.add(civilDateKeyInZone(new Date(end), timezone));

  return [...keys].sort();
}
