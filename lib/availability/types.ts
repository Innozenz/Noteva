/**
 * Types du moteur de créneaux.
 *
 * Le moteur ne connaît ni Prisma ni la base : on lui passe des données déjà
 * chargées et il rend des créneaux. C'est ce qui permet de le tester sur les
 * transitions d'heure d'été sans toucher à Postgres.
 */

/** Règle hebdomadaire récurrente (miroir de AvailabilityRule). */
export type RuleInput = {
  /** ISO-8601 : 1 = lundi … 7 = dimanche. */
  weekday: number;
  /** Minutes depuis minuit, dans le fuseau du prof. 0 ≤ start < end ≤ 1440. */
  startMinute: number;
  endMinute: number;
  /**
   * Bornes de validité de la règle. Ce sont des dates civiles : Prisma rend les
   * colonnes `@db.Date` sous forme de Date à minuit UTC, on les lit donc en UTC.
   */
  validFrom?: Date | null;
  validUntil?: Date | null;
};

export type ExceptionKind = "BLOCKED" | "EXTRA";

/** Exception sur une date précise (miroir de AvailabilityException). */
export type ExceptionInput = {
  /** Date civile, lue en UTC (colonne `@db.Date`). */
  date: Date;
  type: ExceptionKind;
  /** Nuls avec BLOCKED = journée entière bloquée. */
  startMinute?: number | null;
  endMinute?: number | null;
};

/** Occupation déjà posée : réservation, ou tout autre blocage instantané. */
export type BusyInput = {
  startsAt: Date;
  endsAt: Date;
};

export type SlotEngineInput = {
  /** Fuseau IANA du prof — c'est lui qui donne son sens à `startMinute`. */
  timezone: string;
  rules: RuleInput[];
  exceptions: ExceptionInput[];
  busy: BusyInput[];
  /** Fenêtre demandée, en instants. */
  range: { from: Date; to: Date };
  /** Durée d'un cours, en minutes. */
  slotDurationMin: number;
  /** Battement appliqué de part et d'autre de chaque occupation. */
  bufferMin?: number;
  /** Délai minimum entre maintenant et le début d'un cours. */
  minNoticeHours?: number;
  /** Horizon de réservation, en jours. */
  bookingHorizonDays?: number;
  /**
   * Pas de la grille de créneaux. Par défaut égal à la durée du cours : des
   * créneaux jointifs. Le mettre à 15 ou 30 donne des départs glissants.
   */
  granularityMin?: number;
  /** Injecté pour rendre le moteur déterministe en test. */
  now: Date;
};

export type Slot = {
  startsAt: Date;
  endsAt: Date;
};
