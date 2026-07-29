import { describe, expect, it } from "vitest";
import { TZDate } from "@date-fns/tz";

import {
  buildWeekAgenda,
  currentWeekStart,
  startOfWeek,
  weekRange,
  type AgendaEvent,
} from "./agenda";

const PARIS = "Europe/Paris";

/** Date civile telle que Prisma rend une colonne `@db.Date` : minuit UTC. */
function civil(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

/** Heure murale dans un fuseau → instant. */
function wall(date: string, time: string, timezone = PARIS): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(new TZDate(y, m - 1, d, hh, mm, 0, 0, timezone).getTime());
}

function lesson(
  id: string,
  startsAt: Date,
  durationMin: number
): AgendaEvent {
  return {
    id,
    startsAt,
    endsAt: new Date(startsAt.getTime() + durationMin * 60_000),
  };
}

function build(overrides: Partial<Parameters<typeof buildWeekAgenda>[0]> = {}) {
  return buildWeekAgenda({
    timezone: PARIS,
    // Semaine du lundi 12 janvier 2026.
    weekStart: "2026-01-12",
    rules: [{ weekday: 1, startMinute: 9 * 60, endMinute: 12 * 60 }],
    exceptions: [],
    events: [],
    now: wall("2026-01-12", "08:00"),
    ...overrides,
  });
}

/** Le jour d'une semaine construite, par sa date civile. */
function day(agenda: ReturnType<typeof build>, date: string) {
  const found = agenda.days.find((d) => d.date === date);
  if (!found) throw new Error(`jour absent de la semaine : ${date}`);
  return found;
}

describe("startOfWeek", () => {
  it("ramène n'importe quel jour au lundi qui le précède", () => {
    expect(startOfWeek("2026-01-12")).toBe("2026-01-12"); // lundi
    expect(startOfWeek("2026-01-15")).toBe("2026-01-12"); // jeudi
    expect(startOfWeek("2026-01-18")).toBe("2026-01-12"); // dimanche
  });

  it("traverse un changement de mois et d'année", () => {
    // Vendredi 1er janvier 2027 → lundi 28 décembre 2026.
    expect(startOfWeek("2027-01-01")).toBe("2026-12-28");
  });

  it("lit la semaine courante dans le fuseau du prof, pas celui du serveur", () => {
    // Lundi 12 janvier 00h30 à Paris, c'est encore dimanche 11 à Londres — donc
    // la semaine précédente pour un prof londonien.
    const instant = wall("2026-01-12", "00:30");

    expect(currentWeekStart(instant, PARIS)).toBe("2026-01-12");
    expect(currentWeekStart(instant, "Europe/London")).toBe("2026-01-05");
  });
});

describe("weekRange", () => {
  it("couvre du lundi minuit au dimanche minuit, en heure murale", () => {
    const range = weekRange("2026-01-12", PARIS);

    expect(range.from.toISOString()).toBe("2026-01-11T23:00:00.000Z");
    expect(range.to.toISOString()).toBe("2026-01-18T23:00:00.000Z");
  });

  it("absorbe le changement d'heure : la semaine dure 167 heures réelles", () => {
    // Semaine du passage à l'heure d'été (dimanche 29 mars 2026).
    const range = weekRange("2026-03-23", PARIS);
    const hours = (range.to.getTime() - range.from.getTime()) / 3_600_000;

    expect(hours).toBe(167);
  });

  it("borne une seule journée quand days = 1 (vue jour)", () => {
    const range = weekRange("2026-01-12", PARIS, 1);

    expect(range.from.toISOString()).toBe("2026-01-11T23:00:00.000Z");
    expect(range.to.toISOString()).toBe("2026-01-12T23:00:00.000Z");
  });
});

describe("buildWeekAgenda — vue jour", () => {
  it("ne construit qu'un jour quand days = 1", () => {
    const agenda = build({ days: 1 });

    expect(agenda.days).toHaveLength(1);
    expect(agenda.days[0].date).toBe("2026-01-12");
  });
});

describe("buildWeekAgenda — placement des cours", () => {
  it("pose un cours à son heure murale", () => {
    const agenda = build({
      events: [lesson("a", wall("2026-01-12", "10:00"), 60)],
    });

    expect(day(agenda, "2026-01-12").events).toMatchObject([
      { startMinute: 600, endMinute: 660, continuesBefore: false, continuesAfter: false },
    ]);
  });

  it("garde la même hauteur de part et d'autre du changement d'heure", () => {
    // Un cours de 10h dure 60 minutes de pendule qu'on soit en hiver ou en été,
    // alors que son décalage UTC, lui, a bougé d'une heure.
    const winter = buildWeekAgenda({
      timezone: PARIS,
      weekStart: "2026-03-23",
      rules: [],
      exceptions: [],
      events: [lesson("a", wall("2026-03-25", "10:00"), 60)],
      now: wall("2026-03-23", "08:00"),
    });

    const summer = buildWeekAgenda({
      timezone: PARIS,
      weekStart: "2026-03-30",
      rules: [],
      exceptions: [],
      events: [lesson("b", wall("2026-04-01", "10:00"), 60)],
      now: wall("2026-03-30", "08:00"),
    });

    expect(day(winter, "2026-03-25").events[0]).toMatchObject({
      startMinute: 600,
      endMinute: 660,
    });
    expect(day(summer, "2026-04-01").events[0]).toMatchObject({
      startMinute: 600,
      endMinute: 660,
    });
  });

  it("occupe deux heures de grille pour une heure réelle à cheval sur le saut de printemps", () => {
    // Dimanche 29 mars 2026 : 2h du matin n'existe pas, l'horloge saute à 3h.
    // Un cours d'une heure réelle démarré à 1h30 se termine donc à 3h30 sur une
    // pendule. La grille est murale : elle doit bien le montrer haut de deux
    // heures, sans quoi le bloc ne coïnciderait pas avec ses étiquettes.
    const agenda = buildWeekAgenda({
      timezone: PARIS,
      weekStart: "2026-03-23",
      rules: [],
      exceptions: [],
      events: [lesson("a", wall("2026-03-29", "01:30"), 60)],
      now: wall("2026-03-23", "08:00"),
    });

    expect(day(agenda, "2026-03-29").events[0]).toMatchObject({
      startMinute: 90,
      endMinute: 210,
    });
  });

  it("étale un cours qui traverse minuit sur les deux journées", () => {
    const agenda = build({
      rules: [],
      events: [lesson("a", wall("2026-01-12", "23:30"), 60)],
    });

    expect(day(agenda, "2026-01-12").events).toMatchObject([
      { startMinute: 1410, endMinute: 1440, continuesBefore: false, continuesAfter: true },
    ]);
    expect(day(agenda, "2026-01-13").events).toMatchObject([
      { startMinute: 0, endMinute: 30, continuesBefore: true, continuesAfter: false },
    ]);
  });

  it("laisse un cours qui finit à minuit pile sur le jour qui s'achève", () => {
    // Bornes semi-ouvertes [start, end) : sinon le lendemain hériterait d'un
    // bloc de hauteur nulle.
    const agenda = build({
      rules: [],
      events: [lesson("a", wall("2026-01-12", "23:00"), 60)],
    });

    expect(day(agenda, "2026-01-12").events).toMatchObject([
      { startMinute: 1380, endMinute: 1440, continuesAfter: false },
    ]);
    expect(day(agenda, "2026-01-13").events).toHaveLength(0);
  });

  it("ignore un cours de durée nulle ou inversée", () => {
    const start = wall("2026-01-12", "10:00");

    const agenda = build({
      events: [
        { id: "vide", startsAt: start, endsAt: start },
        { id: "inverse", startsAt: start, endsAt: wall("2026-01-12", "09:00") },
      ],
    });

    expect(day(agenda, "2026-01-12").events).toHaveLength(0);
  });

  it("ne retient que les cours de la semaine demandée", () => {
    const agenda = build({
      events: [
        lesson("dedans", wall("2026-01-12", "10:00"), 60),
        lesson("avant", wall("2026-01-11", "10:00"), 60),
        lesson("apres", wall("2026-01-19", "10:00"), 60),
      ],
    });

    const all = agenda.days.flatMap((d) => d.events.map((e) => e.event.id));

    expect(all).toEqual(["dedans"]);
  });
});

describe("buildWeekAgenda — chevauchements", () => {
  it("répartit en colonnes deux cours superposés", () => {
    // booking_teacher_no_overlap ne couvre que PENDING et CONFIRMED : un cours
    // terminé et une nouvelle demande peuvent occuper la même heure.
    const agenda = build({
      events: [
        lesson("a", wall("2026-01-12", "10:00"), 60),
        lesson("b", wall("2026-01-12", "10:30"), 60),
      ],
    });

    expect(day(agenda, "2026-01-12").events).toMatchObject([
      { event: { id: "a" }, column: 0, columns: 2 },
      { event: { id: "b" }, column: 1, columns: 2 },
    ]);
  });

  it("ne rétrécit pas un cours isolé à cause d'un chevauchement ailleurs", () => {
    const agenda = build({
      events: [
        lesson("a", wall("2026-01-12", "10:00"), 60),
        lesson("b", wall("2026-01-12", "10:30"), 60),
        lesson("seul", wall("2026-01-12", "17:00"), 60),
      ],
    });

    const events = day(agenda, "2026-01-12").events;

    expect(events.find((e) => e.event.id === "seul")).toMatchObject({
      column: 0,
      columns: 1,
    });
  });

  it("ne compte pas comme chevauchement deux cours jointifs", () => {
    // Bornes semi-ouvertes, même convention que tstzrange('[)') en base : un
    // cours de 11h suit un cours de 10h-11h sans le chevaucher.
    const agenda = build({
      events: [
        lesson("a", wall("2026-01-12", "10:00"), 60),
        lesson("b", wall("2026-01-12", "11:00"), 60),
      ],
    });

    expect(
      day(agenda, "2026-01-12").events.every((e) => e.columns === 1)
    ).toBe(true);
  });

  it("réutilise une colonne libérée dans une grappe de trois", () => {
    const agenda = build({
      events: [
        lesson("a", wall("2026-01-12", "10:00"), 120), // 10h-12h
        lesson("b", wall("2026-01-12", "10:30"), 30), // 10h30-11h
        lesson("c", wall("2026-01-12", "11:00"), 30), // 11h-11h30
      ],
    });

    // `c` ne chevauche pas `b` : il reprend sa colonne, la grappe reste large
    // de deux colonnes plutôt que trois.
    expect(day(agenda, "2026-01-12").events).toMatchObject([
      { event: { id: "a" }, column: 0, columns: 2 },
      { event: { id: "b" }, column: 1, columns: 2 },
      { event: { id: "c" }, column: 1, columns: 2 },
    ]);
  });
});

describe("buildWeekAgenda — fond de grille", () => {
  it("ouvre les jours qui portent une règle, et eux seuls", () => {
    const agenda = build();

    expect(day(agenda, "2026-01-12").open).toEqual([{ start: 540, end: 720 }]);
    expect(day(agenda, "2026-01-13").open).toEqual([]);
  });

  it("montre un congé là où le prof était ouvert", () => {
    const agenda = build({
      exceptions: [
        {
          date: civil("2026-01-12"),
          type: "BLOCKED",
          startMinute: 10 * 60,
          endMinute: 11 * 60,
        },
      ],
    });

    const monday = day(agenda, "2026-01-12");

    expect(monday.open).toEqual([
      { start: 540, end: 600 },
      { start: 660, end: 720 },
    ]);
    expect(monday.closed).toEqual([{ start: 600, end: 660 }]);
  });

  it("ne montre rien d'un congé posé sur un jour jamais ouvert", () => {
    // Il n'a rien retiré : afficher une bande grise laisserait croire à une
    // journée annulée alors qu'elle n'a jamais été travaillée.
    const agenda = build({
      exceptions: [{ date: civil("2026-01-13"), type: "BLOCKED" }],
    });

    expect(day(agenda, "2026-01-13").closed).toEqual([]);
  });

  it("couvre la journée entière quand le congé n'a pas de bornes", () => {
    const agenda = build({
      exceptions: [{ date: civil("2026-01-12"), type: "BLOCKED" }],
    });

    const monday = day(agenda, "2026-01-12");

    expect(monday.open).toEqual([]);
    expect(monday.closed).toEqual([{ start: 540, end: 720 }]);
  });

  it("ouvre un créneau exceptionnel hors grille hebdomadaire", () => {
    const agenda = build({
      exceptions: [
        {
          date: civil("2026-01-14"),
          type: "EXTRA",
          startMinute: 14 * 60,
          endMinute: 16 * 60,
        },
      ],
    });

    expect(day(agenda, "2026-01-14").open).toEqual([{ start: 840, end: 960 }]);
  });

  it("marque le jour courant dans le fuseau du prof", () => {
    const agenda = build({ now: wall("2026-01-14", "10:00") });

    expect(agenda.days.filter((d) => d.isToday).map((d) => d.date)).toEqual([
      "2026-01-14",
    ]);
  });
});

describe("buildWeekAgenda — amplitude affichée", () => {
  it("englobe un cours tombé hors des plages ouvertes", () => {
    // Cas réel : le prof resserre ses horaires après avoir accepté un cours.
    // Une grille calée sur les seules ouvertures le rendrait invisible.
    const agenda = build({
      events: [lesson("a", wall("2026-01-13", "19:00"), 60)],
    });

    expect(agenda.startMinute).toBe(9 * 60);
    expect(agenda.endMinute).toBe(20 * 60);
  });

  it("arrondit aux heures pleines", () => {
    // Plage déjà plus large que le plancher de six heures, pour n'observer que
    // l'arrondi.
    const agenda = build({
      rules: [{ weekday: 1, startMinute: 9 * 60 + 20, endMinute: 16 * 60 + 10 }],
    });

    expect(agenda.startMinute).toBe(9 * 60);
    expect(agenda.endMinute).toBe(17 * 60);
  });

  it("garde six heures d'amplitude minimum", () => {
    const agenda = build({
      rules: [{ weekday: 1, startMinute: 10 * 60, endMinute: 11 * 60 }],
    });

    expect(agenda.endMinute - agenda.startMinute).toBe(6 * 60);
  });

  it("ne déborde pas de la journée sur un créneau de fin de soirée", () => {
    const agenda = build({
      rules: [{ weekday: 1, startMinute: 22 * 60, endMinute: 23 * 60 }],
    });

    expect(agenda.startMinute).toBe(18 * 60);
    expect(agenda.endMinute).toBe(24 * 60);
  });

  it("retombe sur 8h-20h quand la semaine est entièrement vide", () => {
    const agenda = build({ rules: [] });

    expect(agenda.startMinute).toBe(8 * 60);
    expect(agenda.endMinute).toBe(20 * 60);
  });
});
