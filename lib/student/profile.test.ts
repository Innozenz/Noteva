import { describe, expect, it } from "vitest";

import {
  ageOn,
  checkStudentProfile,
  guardianSummary,
  isMinor,
  type StudentProfileInput,
} from "./profile";

const NOW = new Date("2026-07-23T12:00:00Z");

/** Date civile telle que Prisma rend une colonne `@db.Date` : minuit UTC. */
const born = (date: string) => new Date(`${date}T00:00:00Z`);

const profile = (
  overrides: Partial<StudentProfileInput> = {}
): StudentProfileInput => ({
  birthDate: null,
  guardianName: null,
  guardianEmail: null,
  guardianPhone: null,
  ...overrides,
});

describe("ageOn", () => {
  it("compte les années révolues", () => {
    expect(ageOn(born("2000-01-01"), NOW)).toBe(26);
  });

  it("ne compte pas un anniversaire à venir dans l'année", () => {
    expect(ageOn(born("2000-12-31"), NOW)).toBe(25);
  });

  it("compte l'anniversaire le jour même", () => {
    expect(ageOn(born("2008-07-23"), NOW)).toBe(18);
  });

  it("ne le compte pas la veille", () => {
    expect(ageOn(born("2008-07-24"), NOW)).toBe(17);
  });

  it("gère un 29 février", () => {
    expect(ageOn(born("2008-02-29"), NOW)).toBe(18);
  });
});

describe("isMinor", () => {
  it("reconnaît un mineur", () => {
    expect(isMinor(born("2012-05-04"), NOW)).toBe(true);
  });

  it("ne l'est plus le jour de ses 18 ans", () => {
    expect(isMinor(born("2008-07-23"), NOW)).toBe(false);
  });

  it("l'est encore la veille", () => {
    expect(isMinor(born("2008-07-24"), NOW)).toBe(true);
  });

  it("ne présume rien sans date de naissance", () => {
    // Bloquer par défaut empêcherait tout adulte n'ayant pas rempli ce champ
    // de réserver.
    expect(isMinor(null, NOW)).toBe(false);
  });
});

describe("checkStudentProfile", () => {
  it("n'exige rien d'un majeur", () => {
    expect(checkStudentProfile(profile({ birthDate: born("1990-01-01") }), NOW))
      .toEqual([]);
  });

  it("n'exige rien sans date de naissance", () => {
    expect(checkStudentProfile(profile(), NOW)).toEqual([]);
  });

  it("exige nom et contact du responsable pour un mineur", () => {
    const issues = checkStudentProfile(
      profile({ birthDate: born("2012-05-04") }),
      NOW
    );

    expect(issues.map((i) => i.field)).toEqual([
      "guardianName",
      "guardianContact",
    ]);
  });

  it("se contente d'un e-mail comme contact", () => {
    expect(
      checkStudentProfile(
        profile({
          birthDate: born("2012-05-04"),
          guardianName: "Marie Dupont",
          guardianEmail: "marie@example.com",
        }),
        NOW
      )
    ).toEqual([]);
  });

  it("se contente d'un téléphone", () => {
    // Exiger les deux serait excessif pour un parent qui ne relève pas ses
    // e-mails.
    expect(
      checkStudentProfile(
        profile({
          birthDate: born("2012-05-04"),
          guardianName: "Marie Dupont",
          guardianPhone: "0600000000",
        }),
        NOW
      )
    ).toEqual([]);
  });

  it("ne se laisse pas berner par des espaces", () => {
    const issues = checkStudentProfile(
      profile({
        birthDate: born("2012-05-04"),
        guardianName: "   ",
        guardianEmail: "  ",
      }),
      NOW
    );

    expect(issues).toHaveLength(2);
  });

  it("redevient satisfait le jour de la majorité", () => {
    const minor = profile({ birthDate: born("2008-07-23") });

    expect(checkStudentProfile(minor, new Date("2026-07-22T12:00:00Z")))
      .toHaveLength(2);
    expect(checkStudentProfile(minor, NOW)).toEqual([]);
  });
});

describe("guardianSummary", () => {
  it("ne signale rien pour un majeur", () => {
    expect(
      guardianSummary(profile({ birthDate: born("1990-01-01") }), NOW)
    ).toEqual({ isMinor: false, age: 36, contact: null });
  });

  it("rend le contact assemblé pour un mineur", () => {
    expect(
      guardianSummary(
        profile({
          birthDate: born("2012-05-04"),
          guardianName: "Marie Dupont",
          guardianPhone: "0600000000",
        }),
        NOW
      )
    ).toEqual({
      isMinor: true,
      age: 14,
      contact: "Marie Dupont · 0600000000",
    });
  });

  it("rend un contact nul quand rien n'est renseigné", () => {
    expect(
      guardianSummary(profile({ birthDate: born("2012-05-04") }), NOW).contact
    ).toBeNull();
  });

  it("rend un âge nul sans date de naissance", () => {
    expect(guardianSummary(profile(), NOW).age).toBeNull();
  });
});
