import {
  dayOpenings,
  type ExceptionInput,
  type Interval,
  type RuleInput,
} from "@/lib/availability";
import {
  addDays,
  civilDateKeyInZone,
  isoWeekday,
  localMinutesInZone,
  MINUTES_PER_DAY,
  wallClockToInstant,
} from "@/lib/availability/zone";

/**
 * Mise en page de la semaine du prof : une grille 7 jours × heures.
 *
 * Fonction pure, comme le moteur de créneaux, et pour la même raison : ce
 * qu'elle calcule ne se relit pas à l'œil. Un cours est un **instant**
 * (`Timestamptz`), la grille est en **heures murales** — toute l'affaire est
 * dans la conversion, et elle ne se trompe que deux jours par an.
 *
 * Elle ne décide rien du cycle de vie : elle place ce qu'on lui donne. Les
 * actions restent l'affaire de PATCH /api/bookings/[id].
 */

/** Le minimum dont on a besoin pour poser un bloc ; le reste est de l'affichage. */
export type AgendaEvent = {
  id: string;
  startsAt: Date;
  endsAt: Date;
};

export type PlacedEvent<T extends AgendaEvent> = {
  event: T;
  /** Minutes locales **dans ce jour**, déjà bornées à [0, 1440]. */
  startMinute: number;
  endMinute: number;
  /** Le cours a commencé la veille / se termine le lendemain. */
  continuesBefore: boolean;
  continuesAfter: boolean;
  /**
   * Colonne dans le groupe de cours qui se chevauchent, et taille du groupe.
   *
   * Deux cours peuvent se superposer : `booking_teacher_no_overlap` ne couvre
   * que PENDING et CONFIRMED, donc un cours terminé et une nouvelle demande
   * peuvent occuper la même heure. Sans colonnes, l'un cacherait l'autre.
   */
  column: number;
  columns: number;
};

export type AgendaDay<T extends AgendaEvent> = {
  /** Date civile AAAA-MM-JJ, dans le fuseau du prof. */
  date: string;
  /** ISO-8601 : 1 = lundi … 7 = dimanche. */
  weekday: number;
  isToday: boolean;
  /** Plages ouvertes, en minutes locales. */
  open: Interval[];
  /** Plages retirées par un congé, là où le prof était par ailleurs ouvert. */
  closed: Interval[];
  events: PlacedEvent<T>[];
};

export type WeekAgenda<T extends AgendaEvent> = {
  days: AgendaDay<T>[];
  /** Bornes verticales de la grille, en minutes locales. */
  startMinute: number;
  endMinute: number;
};

/** Grille par défaut quand la semaine est entièrement vide : 8h → 20h. */
const DEFAULT_BOUNDS = { start: 8 * 60, end: 20 * 60 };

/** Premier jour du mois suivant, en clé civile, pour un mois « AAAA-MM ». */
function nextMonthFirst(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return m === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(m + 1).padStart(2, "0")}-01`;
}

/**
 * Grille civile d'un mois : du lundi précédant le 1er au dimanche suivant le
 * dernier jour. Les jours débordant sur les mois voisins remplissent les
 * semaines complètes d'un calendrier.
 */
export function monthGrid(month: string): { gridStart: string; gridEnd: string } {
  const first = `${month}-01`;
  const last = addDays(nextMonthFirst(month), -1);
  return {
    gridStart: startOfWeek(first),
    gridEnd: addDays(startOfWeek(last), 6),
  };
}

/** Fenêtre d'instants couverte par la grille du mois, pour la requête SQL. */
export function monthRange(
  month: string,
  timezone: string
): { from: Date; to: Date } {
  const { gridStart, gridEnd } = monthGrid(month);
  return {
    from: new Date(wallClockToInstant(gridStart, 0, timezone)),
    to: new Date(wallClockToInstant(addDays(gridEnd, 1), 0, timezone)),
  };
}

export type MonthCell<T extends AgendaEvent> = {
  /** Date civile AAAA-MM-JJ, dans le fuseau du prof. */
  date: string;
  /** Appartient au mois affiché (les jours des mois voisins sont estompés). */
  inMonth: boolean;
  isToday: boolean;
  /** Cours dont le **début** tombe ce jour-là, du plus tôt au plus tard. */
  events: { event: T; startMinute: number }[];
};

export type MonthAgenda<T extends AgendaEvent> = {
  /** Mois affiché, « AAAA-MM ». */
  month: string;
  /** Semaines de 7 jours (lundi → dimanche). */
  weeks: MonthCell<T>[][];
};

/**
 * Aperçu mensuel : une grille semaines × jours, chaque jour portant les cours
 * qui y commencent. Vue de lecture — elle situe l'activité du mois et renvoie
 * vers le jour ; le placement horaire fin reste l'affaire des vues jour/semaine.
 *
 * Un cours est rangé sous son **jour de début**, lu à l'horloge dans le fuseau
 * du prof (`civilDateKeyInZone`) — jamais déduit d'un décalage, qui se
 * tromperait les jours de changement d'heure.
 */
export function buildMonthAgenda<T extends AgendaEvent>(input: {
  timezone: string;
  month: string;
  events: T[];
  now: Date;
}): MonthAgenda<T> {
  const { timezone, month, events, now } = input;
  const { gridStart, gridEnd } = monthGrid(month);
  const todayKey = civilDateKeyInZone(now, timezone);

  const byDay = new Map<string, { event: T; startMinute: number }[]>();
  for (const event of events) {
    const key = civilDateKeyInZone(event.startsAt, timezone);
    const bucket = byDay.get(key) ?? [];
    bucket.push({ event, startMinute: localMinutesInZone(event.startsAt, timezone) });
    byDay.set(key, bucket);
  }

  const weeks: MonthCell<T>[][] = [];
  let week: MonthCell<T>[] = [];

  // Garde-fou : au plus 6 semaines, une grille de mois n'en compte jamais plus.
  for (let date = gridStart, guard = 0; date <= gridEnd && guard < 43; guard++) {
    const dayEvents = (byDay.get(date) ?? []).sort(
      (a, b) => a.startMinute - b.startMinute
    );

    week.push({
      date,
      inMonth: date.slice(0, 7) === month,
      isToday: date === todayKey,
      events: dayEvents,
    });

    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }

    date = addDays(date, 1);
  }

  return { month, weeks };
}

/**
 * Amplitude minimale affichée. Sans elle, une semaine à un seul cours d'une
 * heure rendrait une grille haute d'une ligne, illisible et fausse à l'œil.
 */
const MIN_SPAN_MINUTES = 6 * 60;

/** Lundi de la semaine contenant `dayKey`. */
export function startOfWeek(dayKey: string): string {
  return addDays(dayKey, -(isoWeekday(dayKey) - 1));
}

/** Semaine courante du prof, dans **son** fuseau et non celui du serveur. */
export function currentWeekStart(now: Date, timezone: string): string {
  return startOfWeek(civilDateKeyInZone(now, timezone));
}

/**
 * Fenêtre d'instants couverte par une semaine murale.
 *
 * C'est ce qu'il faut passer à la requête SQL : les cours sont indexés en
 * instants, et la semaine du prof ne commence pas à minuit UTC.
 */
export function weekRange(
  weekStart: string,
  timezone: string,
  days = 7
): { from: Date; to: Date } {
  return {
    from: new Date(wallClockToInstant(weekStart, 0, timezone)),
    to: new Date(
      wallClockToInstant(addDays(weekStart, days - 1), MINUTES_PER_DAY, timezone)
    ),
  };
}

export function buildWeekAgenda<T extends AgendaEvent>(input: {
  timezone: string;
  /** Clé civile du premier jour affiché (lundi en vue semaine, jour choisi en vue jour). */
  weekStart: string;
  rules: RuleInput[];
  exceptions: ExceptionInput[];
  events: T[];
  now: Date;
  /** Nombre de jours affichés : 7 (semaine) ou 1 (jour). Défaut 7. */
  days?: number;
}): WeekAgenda<T> {
  const { timezone, weekStart, rules, exceptions, events, now } = input;

  const dayKeys = Array.from({ length: input.days ?? 7 }, (_, i) =>
    addDays(weekStart, i)
  );
  const todayKey = civilDateKeyInZone(now, timezone);

  const placed = new Map<string, PlacedEvent<T>[]>(
    dayKeys.map((key) => [key, []])
  );

  for (const event of events) {
    for (const piece of splitAcrossDays(event, timezone)) {
      placed.get(piece.date)?.push(piece.placement);
    }
  }

  const days: AgendaDay<T>[] = dayKeys.map((date) => {
    const { open, closed } = dayOpenings(date, rules, exceptions);

    return {
      date,
      weekday: isoWeekday(date),
      isToday: date === todayKey,
      open,
      closed,
      events: assignColumns(placed.get(date) ?? []),
    };
  });

  return { days, ...verticalBounds(days) };
}

/**
 * Découpe un cours en un morceau par jour civil traversé.
 *
 * Un cours de 23h30 à 0h30 existe des deux côtés de minuit ; le dessiner sur le
 * seul jour de départ le ferait déborder de la colonne. Rare pour un cours de
 * musique, mais rien ne l'interdit.
 *
 * Les minutes locales sont **lues à l'horloge**, jamais déduites d'une
 * soustraction : voir `localMinutesInZone`. Conséquence assumée, le jour du
 * passage à l'heure d'été un cours d'une heure réelle à cheval sur 2h occupe
 * deux heures de grille — c'est exact, il va bien de la ligne 1h30 à la ligne
 * 3h30 sur une pendule.
 */
function splitAcrossDays<T extends AgendaEvent>(
  event: T,
  timezone: string
): { date: string; placement: PlacedEvent<T> }[] {
  if (event.endsAt.getTime() <= event.startsAt.getTime()) return [];

  const startKey = civilDateKeyInZone(event.startsAt, timezone);
  const startMinute = localMinutesInZone(event.startsAt, timezone);

  let endKey = civilDateKeyInZone(event.endsAt, timezone);
  let endMinute = localMinutesInZone(event.endsAt, timezone);

  // Bornes semi-ouvertes [start, end), comme partout ailleurs : un cours qui
  // finit à minuit pile appartient au jour qui s'achève, pas au suivant — où il
  // ne déposerait qu'un bloc de hauteur nulle.
  if (endMinute === 0 && endKey !== startKey) {
    endKey = addDays(endKey, -1);
    endMinute = MINUTES_PER_DAY;
  }

  const pieces: { date: string; placement: PlacedEvent<T> }[] = [];

  // Garde-fou : une donnée aberrante ne doit pas faire boucler indéfiniment.
  for (let date = startKey, guard = 0; date <= endKey && guard < 8; guard++) {
    pieces.push({
      date,
      placement: {
        event,
        startMinute: date === startKey ? startMinute : 0,
        endMinute: date === endKey ? endMinute : MINUTES_PER_DAY,
        continuesBefore: date !== startKey,
        continuesAfter: date !== endKey,
        column: 0,
        columns: 1,
      },
    });

    date = addDays(date, 1);
  }

  return pieces;
}

/**
 * Répartit les cours qui se chevauchent en colonnes côte à côte.
 *
 * La largeur se partage **par grappe** de chevauchement, pas par journée : deux
 * cours superposés à 9h ne doivent pas rétrécir de moitié un cours isolé de
 * 17h.
 */
function assignColumns<T extends AgendaEvent>(
  events: PlacedEvent<T>[]
): PlacedEvent<T>[] {
  const sorted = [...events].sort(
    (a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute
  );

  const result: PlacedEvent<T>[] = [];
  let cluster: PlacedEvent<T>[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    if (cluster.length === 0) return;

    // Chaque cours prend la première colonne libérée ; `end <= start` ne compte
    // pas comme un chevauchement, bornes semi-ouvertes obligent.
    const columnEnds: number[] = [];

    for (const item of cluster) {
      let column = columnEnds.findIndex((end) => end <= item.startMinute);
      if (column === -1) column = columnEnds.length;

      columnEnds[column] = item.endMinute;
      item.column = column;
    }

    for (const item of cluster) item.columns = columnEnds.length;

    result.push(...cluster);
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const item of sorted) {
    if (item.startMinute >= clusterEnd) flush();

    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.endMinute);
  }

  flush();

  return result;
}

/**
 * Amplitude horaire à afficher.
 *
 * Elle englobe les **cours** autant que les ouvertures : un cours réservé avant
 * que le prof ne resserre ses horaires tombe hors de toute plage ouverte, et
 * une grille calée sur les seules ouvertures le rendrait invisible — le pire
 * défaut possible pour un agenda.
 */
function verticalBounds<T extends AgendaEvent>(
  days: AgendaDay<T>[]
): { startMinute: number; endMinute: number } {
  let min = Infinity;
  let max = -Infinity;

  for (const day of days) {
    for (const interval of [...day.open, ...day.closed]) {
      min = Math.min(min, interval.start);
      max = Math.max(max, interval.end);
    }
    for (const placed of day.events) {
      min = Math.min(min, placed.startMinute);
      max = Math.max(max, placed.endMinute);
    }
  }

  if (min === Infinity) {
    return { startMinute: DEFAULT_BOUNDS.start, endMinute: DEFAULT_BOUNDS.end };
  }

  // Heures pleines : la colonne d'étiquettes est graduée à l'heure.
  let start = Math.floor(min / 60) * 60;
  let end = Math.ceil(max / 60) * 60;

  if (end - start < MIN_SPAN_MINUTES) {
    end = start + MIN_SPAN_MINUTES;

    if (end > MINUTES_PER_DAY) {
      end = MINUTES_PER_DAY;
      start = end - MIN_SPAN_MINUTES;
    }
  }

  return { startMinute: Math.max(0, start), endMinute: end };
}
