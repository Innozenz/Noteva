import { describe, expect, it } from "vitest";

import { groupSlotsByPeriod, periodOf } from "./day-period";

/**
 * Ce qui se vérifie à l'œil : que les plages s'affichent. Ce qui ne se vérifie
 * qu'ici : qu'elles soient lues dans le fuseau du **prof**. Un développeur assis
 * à Paris qui teste un prof à Paris ne verra jamais la différence.
 */

const PARIS = "Europe/Paris";

/** Créneaux réduits à ce dont le regroupement a besoin. */
const at = (iso: string) => ({ startsAt: new Date(iso) });
const startsAt = (slot: { startsAt: Date }) => slot.startsAt;

describe("periodOf", () => {
  it("découpe la journée à midi et à 18 h, heure du prof", () => {
    // Paris est à UTC+2 en été : 07:00Z = 09:00 à Paris.
    expect(periodOf(new Date("2026-08-03T07:00:00Z"), PARIS)).toBe("MORNING");
    expect(periodOf(new Date("2026-08-03T12:00:00Z"), PARIS)).toBe("AFTERNOON");
    expect(periodOf(new Date("2026-08-03T17:00:00Z"), PARIS)).toBe("EVENING");
  });

  it("place midi pile l'après-midi et 18 h pile le soir", () => {
    // Bornes basses incluses : sans quoi un créneau de midi tomberait au matin.
    expect(periodOf(new Date("2026-08-03T10:00:00Z"), PARIS)).toBe("AFTERNOON");
    expect(periodOf(new Date("2026-08-03T16:00:00Z"), PARIS)).toBe("EVENING");
    expect(periodOf(new Date("2026-08-03T09:59:00Z"), PARIS)).toBe("MORNING");
    expect(periodOf(new Date("2026-08-03T15:59:00Z"), PARIS)).toBe("AFTERNOON");
  });

  it("lit l'heure du prof, pas celle du visiteur", () => {
    // 23:00 à Paris — le soir — mais 17:00 à New York, soit l'après-midi. Le
    // même instant doit être « Soir » puisque c'est le prof qui donne le cours.
    const instant = new Date("2026-08-03T21:00:00Z");

    expect(periodOf(instant, PARIS)).toBe("EVENING");
    expect(periodOf(instant, "America/New_York")).toBe("AFTERNOON");
  });

  it("suit le changement d'heure plutôt que le décalage UTC", () => {
    // 2026-10-25 : Paris repasse de UTC+2 à UTC+1 à 03:00 locale. 10:30Z est
    // donc 11:30 à Paris — le matin — alors que la veille le même écart
    // donnait 12:30, soit l'après-midi.
    expect(periodOf(new Date("2026-10-25T10:30:00Z"), PARIS)).toBe("MORNING");
    expect(periodOf(new Date("2026-10-24T10:30:00Z"), PARIS)).toBe("AFTERNOON");
  });
});

describe("groupSlotsByPeriod", () => {
  it("ne rend rien sans créneau", () => {
    expect(groupSlotsByPeriod([], startsAt, PARIS)).toEqual([]);
  });

  it("groupe par jour civil du prof, puis par plage", () => {
    const days = groupSlotsByPeriod(
      [
        at("2026-08-03T07:00:00Z"), // lundi 09:00
        at("2026-08-03T08:00:00Z"), // lundi 10:00
        at("2026-08-03T16:00:00Z"), // lundi 18:00
        at("2026-08-04T12:00:00Z"), // mardi 14:00
      ],
      startsAt,
      PARIS
    );

    expect(days.map((day) => day.date)).toEqual(["2026-08-03", "2026-08-04"]);
    expect(days[0].periods.map((group) => group.period)).toEqual([
      "MORNING",
      "EVENING",
    ]);
    expect(days[0].periods[0].slots).toHaveLength(2);
    expect(days[1].periods.map((group) => group.period)).toEqual(["AFTERNOON"]);
  });

  it("n'affiche pas les plages vides", () => {
    const days = groupSlotsByPeriod(
      [at("2026-08-03T07:00:00Z"), at("2026-08-03T09:00:00Z")],
      startsAt,
      PARIS
    );

    // Un prof qui n'enseigne que le matin ne doit pas afficher un
    // « Après-midi » suivi de rien : ça le ferait passer pour complet.
    expect(days[0].periods).toHaveLength(1);
    expect(days[0].periods[0].period).toBe("MORNING");
  });

  it("range les plages dans l'ordre de la journée, quel que soit celui d'arrivée", () => {
    const days = groupSlotsByPeriod(
      [
        at("2026-08-03T17:00:00Z"), // 19:00
        at("2026-08-03T07:00:00Z"), // 09:00
        at("2026-08-03T12:00:00Z"), // 14:00
      ],
      startsAt,
      PARIS
    );

    expect(days[0].periods.map((group) => group.period)).toEqual([
      "MORNING",
      "AFTERNOON",
      "EVENING",
    ]);
  });

  it("rattache un créneau au jour du prof et non à celui de l'instant UTC", () => {
    // 22:30 UTC un lundi, soit 00:30 le mardi à Paris : le créneau appartient
    // au mardi du prof.
    const days = groupSlotsByPeriod(
      [at("2026-08-03T22:30:00Z")],
      startsAt,
      PARIS
    );

    expect(days[0].date).toBe("2026-08-04");
    expect(days[0].periods[0].period).toBe("MORNING");
  });
});
