import { TZDate } from "@date-fns/tz";

import { clamp, normalize, subtract, type Interval } from "./intervals";
import type {
  ExceptionInput,
  RuleInput,
  Slot,
  SlotEngineInput,
} from "./types";

export * from "./types";
export { type Interval } from "./intervals";

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const MINUTES_PER_DAY = 1440;

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
    for (const local of openMinutesForDay(dayKey, rules, exceptions)) {
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

  // 3. Découpage. Le pas s'applique en instants : sur un jour de changement
  // d'heure, une plage locale de 3h peut ne durer que 2h réelles, et le nombre
  // de créneaux suit.
  const durationMs = slotDurationMin * MINUTE_MS;
  const stepMs = step * MINUTE_MS;
  const slots: Slot[] = [];

  for (const interval of free) {
    for (let t = interval.start; t + durationMs <= interval.end; t += stepMs) {
      slots.push({ startsAt: new Date(t), endsAt: new Date(t + durationMs) });
    }
  }

  return slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/**
 * Ouvertures d'une journée civile, en minutes depuis minuit local :
 * (règles hebdo ∪ exceptions EXTRA) − exceptions BLOCKED.
 */
function openMinutesForDay(
  dayKey: string,
  rules: RuleInput[],
  exceptions: ExceptionInput[]
): Interval[] {
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

  return subtract(normalize([...base, ...extra]), blocked);
}

function isRuleActiveOn(rule: RuleInput, dayKey: string): boolean {
  if (rule.validFrom && dayKey < civilDateKey(rule.validFrom)) return false;
  if (rule.validUntil && dayKey > civilDateKey(rule.validUntil)) return false;
  return true;
}

/**
 * Instant correspondant à une heure murale dans un fuseau donné.
 *
 * `minute` peut valoir 1440 : minuit le lendemain, ce que le constructeur
 * normalise comme le fait `Date`.
 */
function wallClockToInstant(
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

/** Date civile d'un instant, lue dans un fuseau. */
function civilDateKeyInZone(instant: Date, timezone: string): string {
  const zoned = new TZDate(instant.getTime(), timezone);
  return formatKey(zoned.getFullYear(), zoned.getMonth() + 1, zoned.getDate());
}

/**
 * Date civile d'une colonne `@db.Date`. Prisma rend ces valeurs sous forme de
 * Date à minuit UTC : les lire en heure locale du serveur décalerait d'un jour
 * pour tout fuseau derrière UTC.
 */
function civilDateKey(date: Date): string {
  return formatKey(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate()
  );
}

/** 1 = lundi … 7 = dimanche, calculé sur la date civile seule. */
function isoWeekday(dayKey: string): number {
  const [year, month, day] = dayKey.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

function formatKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
