import { describe, expect, it } from "vitest";

import { checkPublishable, type PublishableProfile } from "./publishable";
import { formatTime, normalizeWeeklyGrid, parseTime } from "./weekly-grid";

function completeProfile(
  overrides: Partial<PublishableProfile> = {}
): PublishableProfile {
  return {
    headline: "Prof de chant, 10 ans d'expérience",
    bio: "J'accompagne les chanteurs débutants comme confirmés vers plus d'aisance vocale, en travaillant le souffle, la justesse et l'interprétation.",
    hourlyRateCents: 4000,
    teachesOnline: true,
    teachesInPerson: false,
    teachesAtHome: false,
    city: null,
    instrumentCount: 1,
    availabilityRuleCount: 2,
    ...overrides,
  };
}

const fieldsOf = (profile: PublishableProfile) =>
  checkPublishable(profile).missing.map((m) => m.field);

describe("checkPublishable", () => {
  it("accepte une fiche complète en visio", () => {
    expect(checkPublishable(completeProfile())).toEqual({ ok: true, missing: [] });
  });

  it("exige une accroche", () => {
    expect(fieldsOf(completeProfile({ headline: "   " }))).toContain("headline");
  });

  it("exige une bio substantielle", () => {
    expect(fieldsOf(completeProfile({ bio: "Je donne des cours." }))).toContain(
      "bio"
    );
  });

  it("indique la longueur atteinte pour la bio", () => {
    const { missing } = checkPublishable(completeProfile({ bio: "trop court" }));
    const bio = missing.find((m) => m.field === "bio");

    expect(bio?.message).toContain("10");
  });

  it("exige un tarif strictement positif", () => {
    expect(fieldsOf(completeProfile({ hourlyRateCents: null }))).toContain(
      "hourlyRateCents"
    );
    expect(fieldsOf(completeProfile({ hourlyRateCents: 0 }))).toContain(
      "hourlyRateCents"
    );
  });

  it("exige au moins un instrument", () => {
    expect(fieldsOf(completeProfile({ instrumentCount: 0 }))).toContain(
      "instruments"
    );
  });

  it("exige au moins une modalité", () => {
    expect(
      fieldsOf(
        completeProfile({
          teachesOnline: false,
          teachesInPerson: false,
          teachesAtHome: false,
        })
      )
    ).toContain("modes");
  });

  it("exige une ville dès qu'il y a du présentiel", () => {
    expect(
      fieldsOf(completeProfile({ teachesInPerson: true, city: null }))
    ).toContain("city");
    expect(
      fieldsOf(completeProfile({ teachesAtHome: true, city: null }))
    ).toContain("city");
  });

  it("n'exige pas de ville en visio seule", () => {
    expect(fieldsOf(completeProfile({ city: null }))).not.toContain("city");
  });

  it("exige au moins une disponibilité", () => {
    // Sans ça, l'élève trouve la fiche, l'ouvre, et ne peut rien réserver.
    expect(fieldsOf(completeProfile({ availabilityRuleCount: 0 }))).toContain(
      "availability"
    );
  });

  it("remonte tous les manques d'un coup", () => {
    const empty: PublishableProfile = {
      headline: null,
      bio: null,
      hourlyRateCents: null,
      teachesOnline: false,
      teachesInPerson: false,
      teachesAtHome: false,
      city: null,
      instrumentCount: 0,
      availabilityRuleCount: 0,
    };

    expect(checkPublishable(empty).missing).toHaveLength(6);
  });
});

describe("normalizeWeeklyGrid", () => {
  it("fusionne deux plages qui se chevauchent le même jour", () => {
    const result = normalizeWeeklyGrid([
      { weekday: 1, startMinute: 540, endMinute: 720 },
      { weekday: 1, startMinute: 660, endMinute: 840 },
    ]);

    expect(result).toEqual({
      ok: true,
      slots: [{ weekday: 1, startMinute: 540, endMinute: 840 }],
    });
  });

  it("fusionne deux plages jointives", () => {
    const result = normalizeWeeklyGrid([
      { weekday: 3, startMinute: 540, endMinute: 600 },
      { weekday: 3, startMinute: 600, endMinute: 660 },
    ]);

    expect(result.ok && result.slots).toEqual([
      { weekday: 3, startMinute: 540, endMinute: 660 },
    ]);
  });

  it("laisse deux plages disjointes du même jour", () => {
    const result = normalizeWeeklyGrid([
      { weekday: 2, startMinute: 540, endMinute: 720 },
      { weekday: 2, startMinute: 840, endMinute: 1080 },
    ]);

    expect(result.ok && result.slots).toHaveLength(2);
  });

  it("ne mélange pas les jours", () => {
    const result = normalizeWeeklyGrid([
      { weekday: 1, startMinute: 540, endMinute: 720 },
      { weekday: 2, startMinute: 540, endMinute: 720 },
    ]);

    expect(result.ok && result.slots.map((s) => s.weekday)).toEqual([1, 2]);
  });

  it("trie par jour croissant", () => {
    const result = normalizeWeeklyGrid([
      { weekday: 7, startMinute: 540, endMinute: 600 },
      { weekday: 1, startMinute: 540, endMinute: 600 },
    ]);

    expect(result.ok && result.slots.map((s) => s.weekday)).toEqual([1, 7]);
  });

  it("refuse une borne inversée", () => {
    const result = normalizeWeeklyGrid([
      { weekday: 1, startMinute: 720, endMinute: 540 },
    ]);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors[0].index).toBe(0);
  });

  it("refuse un jour hors 1-7 et un horaire hors journée", () => {
    expect(
      normalizeWeeklyGrid([{ weekday: 0, startMinute: 0, endMinute: 60 }]).ok
    ).toBe(false);
    expect(
      normalizeWeeklyGrid([{ weekday: 1, startMinute: 0, endMinute: 1441 }]).ok
    ).toBe(false);
  });

  it("accepte minuit comme borne de fin", () => {
    const result = normalizeWeeklyGrid([
      { weekday: 5, startMinute: 1320, endMinute: 1440 },
    ]);

    expect(result.ok).toBe(true);
  });

  it("rend une grille vide sans erreur", () => {
    expect(normalizeWeeklyGrid([])).toEqual({ ok: true, slots: [] });
  });
});

describe("parseTime / formatTime", () => {
  it("fait l'aller-retour", () => {
    for (const value of ["00:00", "09:30", "13:45", "23:59", "24:00"]) {
      expect(formatTime(parseTime(value)!)).toBe(value);
    }
  });

  it("accepte une heure sur un seul chiffre", () => {
    expect(parseTime("9:30")).toBe(570);
  });

  it("refuse une saisie inexploitable", () => {
    for (const value of ["", "9h30", "25:00", "12:60", "abc", "12:3"]) {
      expect(parseTime(value)).toBeNull();
    }
  });
});
