import { describe, expect, it } from "vitest";
import { TZDate } from "@date-fns/tz";

import { computeAvailableSlots } from "./index";
import type { SlotEngineInput } from "./types";

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

/** Créneaux relus en heure murale du prof, pour des assertions lisibles. */
function asWallClock(
  slots: { startsAt: Date }[],
  timezone = PARIS
): string[] {
  return slots.map((s) => {
    const z = new TZDate(s.startsAt.getTime(), timezone);
    return `${String(z.getHours()).padStart(2, "0")}:${String(z.getMinutes()).padStart(2, "0")}`;
  });
}

function baseInput(overrides: Partial<SlotEngineInput> = {}): SlotEngineInput {
  return {
    timezone: PARIS,
    // Lundi 9h-12h.
    rules: [{ weekday: 1, startMinute: 9 * 60, endMinute: 12 * 60 }],
    exceptions: [],
    busy: [],
    // Lundi 12 janvier 2026.
    range: { from: civil("2026-01-12"), to: civil("2026-01-13") },
    slotDurationMin: 60,
    now: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("computeAvailableSlots", () => {
  it("découpe une règle hebdomadaire en créneaux jointifs", () => {
    const slots = computeAvailableSlots(baseInput());

    expect(asWallClock(slots)).toEqual(["09:00", "10:00", "11:00"]);
    expect(slots[0].startsAt.toISOString()).toBe("2026-01-12T08:00:00.000Z");
    expect(slots[0].endsAt.toISOString()).toBe("2026-01-12T09:00:00.000Z");
  });

  it("ne produit rien le mauvais jour de la semaine", () => {
    const slots = computeAvailableSlots(
      baseInput({
        // Mardi.
        range: { from: civil("2026-01-13"), to: civil("2026-01-14") },
      })
    );

    expect(slots).toHaveLength(0);
  });

  it("respecte le pas de grille quand il diffère de la durée", () => {
    const slots = computeAvailableSlots(
      baseInput({ slotDurationMin: 60, granularityMin: 30 })
    );

    expect(asWallClock(slots)).toEqual([
      "09:00",
      "09:30",
      "10:00",
      "10:30",
      "11:00",
    ]);
  });

  it("laisse un créneau de 45 min dépasser sans déborder de la plage", () => {
    const slots = computeAvailableSlots(baseInput({ slotDurationMin: 45 }));

    expect(asWallClock(slots)).toEqual(["09:00", "09:45", "10:30", "11:15"]);
    expect(slots.at(-1)!.endsAt.getTime()).toBe(
      wall("2026-01-12", "12:00").getTime()
    );
  });

  // --- Fuseaux et heure d'été : la raison d'être de ce moteur ---------------

  describe("heure d'été", () => {
    it("garde 9h à 9h heure locale de part et d'autre du changement d'heure", () => {
      const winter = computeAvailableSlots(baseInput());
      const summer = computeAvailableSlots(
        baseInput({
          // Lundi 13 juillet 2026.
          range: { from: civil("2026-07-13"), to: civil("2026-07-14") },
        })
      );

      // Même heure murale…
      expect(asWallClock(winter)[0]).toBe("09:00");
      expect(asWallClock(summer)[0]).toBe("09:00");

      // …mais pas le même instant : UTC+1 en janvier, UTC+2 en juillet.
      expect(winter[0].startsAt.toISOString()).toBe("2026-01-12T08:00:00.000Z");
      expect(summer[0].startsAt.toISOString()).toBe("2026-07-13T07:00:00.000Z");
    });

    it("perd une heure le jour du passage à l'heure d'été", () => {
      // 29 mars 2026 (dimanche) : 2h00 saute à 3h00 en Europe/Paris.
      // La plage est bornée en heure murale : `civil()` donnerait minuit UTC,
      // soit 1h ou 2h du matin à Paris, et amputerait le début de la journée.
      const slots = computeAvailableSlots(
        baseInput({
          rules: [{ weekday: 7, startMinute: 60, endMinute: 4 * 60 }],
          range: {
            from: wall("2026-03-29", "00:00"),
            to: wall("2026-03-30", "00:00"),
          },
        })
      );

      // Une plage locale de 1h à 4h ne dure que deux heures réelles.
      expect(slots).toHaveLength(2);
      expect(slots[0].startsAt.toISOString()).toBe("2026-03-29T00:00:00.000Z");
      expect(slots[1].startsAt.toISOString()).toBe("2026-03-29T01:00:00.000Z");
      // Aucun créneau ne démarre dans l'heure qui n'existe pas.
      expect(asWallClock(slots)).not.toContain("02:00");
    });

    it("gagne une heure le jour du retour à l'heure d'hiver", () => {
      // 25 octobre 2026 (dimanche) : 3h00 revient à 2h00, l'heure locale
      // 2h-3h est donc vécue deux fois.
      const slots = computeAvailableSlots(
        baseInput({
          rules: [{ weekday: 7, startMinute: 60, endMinute: 4 * 60 }],
          range: {
            from: wall("2026-10-25", "00:00"),
            to: wall("2026-10-26", "00:00"),
          },
        })
      );

      // Une plage locale de 1h à 4h dure quatre heures réelles.
      expect(slots).toHaveLength(4);
      expect(slots[0].startsAt.toISOString()).toBe("2026-10-24T23:00:00.000Z");
      expect(slots.at(-1)!.endsAt.toISOString()).toBe(
        "2026-10-25T03:00:00.000Z"
      );
      // 2h du matin arrive deux fois, à une heure d'intervalle réelle.
      expect(asWallClock(slots)).toEqual(["01:00", "02:00", "02:00", "03:00"]);
    });

    it("calcule dans le fuseau du prof, pas celui du serveur", () => {
      const slots = computeAvailableSlots(
        baseInput({
          timezone: "Asia/Tokyo",
          range: { from: civil("2026-01-11"), to: civil("2026-01-13") },
        })
      );

      // 9h à Tokyo (UTC+9) le lundi = 00:00Z le même jour.
      expect(slots[0].startsAt.toISOString()).toBe("2026-01-12T00:00:00.000Z");
      expect(asWallClock(slots, "Asia/Tokyo")).toEqual([
        "09:00",
        "10:00",
        "11:00",
      ]);
    });
  });

  // --- Occupations ---------------------------------------------------------

  it("retire le créneau occupé par une réservation", () => {
    const slots = computeAvailableSlots(
      baseInput({
        busy: [
          {
            startsAt: wall("2026-01-12", "10:00"),
            endsAt: wall("2026-01-12", "11:00"),
          },
        ],
      })
    );

    expect(asWallClock(slots)).toEqual(["09:00", "11:00"]);
  });

  it("autorise un créneau jointif à une réservation (bornes semi-ouvertes)", () => {
    const slots = computeAvailableSlots(
      baseInput({
        busy: [
          {
            startsAt: wall("2026-01-12", "09:00"),
            endsAt: wall("2026-01-12", "10:00"),
          },
        ],
      })
    );

    expect(asWallClock(slots)).toEqual(["10:00", "11:00"]);
  });

  it("élargit les réservations du battement", () => {
    const slots = computeAvailableSlots(
      baseInput({
        bufferMin: 30,
        busy: [
          {
            startsAt: wall("2026-01-12", "10:00"),
            endsAt: wall("2026-01-12", "11:00"),
          },
        ],
      })
    );

    // 9h-10h mord sur le battement d'avant, 11h-12h sur celui d'après.
    expect(slots).toHaveLength(0);
  });

  it("fusionne des réservations qui se chevauchent", () => {
    const slots = computeAvailableSlots(
      baseInput({
        busy: [
          {
            startsAt: wall("2026-01-12", "09:30"),
            endsAt: wall("2026-01-12", "10:30"),
          },
          {
            startsAt: wall("2026-01-12", "10:00"),
            endsAt: wall("2026-01-12", "11:00"),
          },
        ],
      })
    );

    expect(asWallClock(slots)).toEqual(["11:00"]);
  });

  // --- Exceptions ----------------------------------------------------------

  it("bloque la journée entière quand l'exception n'a pas de bornes", () => {
    const slots = computeAvailableSlots(
      baseInput({
        exceptions: [{ date: civil("2026-01-12"), type: "BLOCKED" }],
      })
    );

    expect(slots).toHaveLength(0);
  });

  it("bloque partiellement une journée", () => {
    const slots = computeAvailableSlots(
      baseInput({
        exceptions: [
          {
            date: civil("2026-01-12"),
            type: "BLOCKED",
            startMinute: 10 * 60,
            endMinute: 11 * 60,
          },
        ],
      })
    );

    expect(asWallClock(slots)).toEqual(["09:00", "11:00"]);
  });

  it("n'applique une exception qu'à sa date", () => {
    const slots = computeAvailableSlots(
      baseInput({
        exceptions: [{ date: civil("2026-01-19"), type: "BLOCKED" }],
      })
    );

    expect(asWallClock(slots)).toEqual(["09:00", "10:00", "11:00"]);
  });

  it("ouvre une disponibilité exceptionnelle hors règles hebdomadaires", () => {
    const slots = computeAvailableSlots(
      baseInput({
        // Mardi, aucune règle.
        range: { from: civil("2026-01-13"), to: civil("2026-01-14") },
        exceptions: [
          {
            date: civil("2026-01-13"),
            type: "EXTRA",
            startMinute: 14 * 60,
            endMinute: 16 * 60,
          },
        ],
      })
    );

    expect(asWallClock(slots)).toEqual(["14:00", "15:00"]);
  });

  it("fait primer un blocage sur une ouverture exceptionnelle", () => {
    const slots = computeAvailableSlots(
      baseInput({
        exceptions: [
          {
            date: civil("2026-01-12"),
            type: "EXTRA",
            startMinute: 14 * 60,
            endMinute: 16 * 60,
          },
          { date: civil("2026-01-12"), type: "BLOCKED" },
        ],
      })
    );

    expect(slots).toHaveLength(0);
  });

  // --- Validité des règles -------------------------------------------------

  it("ignore une règle hors de sa période de validité", () => {
    const before = computeAvailableSlots(
      baseInput({
        rules: [
          {
            weekday: 1,
            startMinute: 9 * 60,
            endMinute: 12 * 60,
            validFrom: civil("2026-02-01"),
          },
        ],
      })
    );
    const after = computeAvailableSlots(
      baseInput({
        rules: [
          {
            weekday: 1,
            startMinute: 9 * 60,
            endMinute: 12 * 60,
            validUntil: civil("2026-01-11"),
          },
        ],
      })
    );

    expect(before).toHaveLength(0);
    expect(after).toHaveLength(0);
  });

  it("applique une règle le jour même de sa borne de validité", () => {
    const slots = computeAvailableSlots(
      baseInput({
        rules: [
          {
            weekday: 1,
            startMinute: 9 * 60,
            endMinute: 12 * 60,
            validFrom: civil("2026-01-12"),
            validUntil: civil("2026-01-12"),
          },
        ],
      })
    );

    expect(slots).toHaveLength(3);
  });

  // --- Préavis et horizon --------------------------------------------------

  it("écarte les créneaux sous le préavis minimum", () => {
    const slots = computeAvailableSlots(
      baseInput({
        minNoticeHours: 24,
        // 11 janvier 10h : le préavis court jusqu'au 12 à 10h.
        now: wall("2026-01-11", "10:00"),
      })
    );

    expect(asWallClock(slots)).toEqual(["10:00", "11:00"]);
  });

  it("écarte les créneaux au-delà de l'horizon de réservation", () => {
    const slots = computeAvailableSlots(
      baseInput({
        bookingHorizonDays: 7,
        now: wall("2026-01-01", "10:00"),
      })
    );

    expect(slots).toHaveLength(0);
  });

  // --- Cas limites ---------------------------------------------------------

  it("gère une plage qui court jusqu'à minuit", () => {
    const slots = computeAvailableSlots(
      baseInput({
        rules: [{ weekday: 1, startMinute: 22 * 60, endMinute: 1440 }],
      })
    );

    expect(asWallClock(slots)).toEqual(["22:00", "23:00"]);
    expect(slots.at(-1)!.endsAt.toISOString()).toBe(
      "2026-01-12T23:00:00.000Z" // minuit heure de Paris
    );
  });

  it("fusionne deux règles contiguës du même jour", () => {
    const slots = computeAvailableSlots(
      baseInput({
        rules: [
          { weekday: 1, startMinute: 9 * 60, endMinute: 10 * 60 },
          { weekday: 1, startMinute: 10 * 60, endMinute: 11 * 60 },
        ],
      })
    );

    expect(asWallClock(slots)).toEqual(["09:00", "10:00"]);
  });

  it("ne rend rien quand la durée dépasse la plage disponible", () => {
    const slots = computeAvailableSlots(baseInput({ slotDurationMin: 240 }));

    expect(slots).toHaveLength(0);
  });

  it("rend un tableau vide pour une durée non valide", () => {
    expect(computeAvailableSlots(baseInput({ slotDurationMin: 0 }))).toEqual([]);
  });

  it("rend un tableau vide quand la plage est inversée", () => {
    const slots = computeAvailableSlots(
      baseInput({
        range: { from: civil("2026-01-13"), to: civil("2026-01-12") },
      })
    );

    expect(slots).toHaveLength(0);
  });

  it("rend les créneaux triés par instant croissant", () => {
    const slots = computeAvailableSlots(
      baseInput({
        range: { from: civil("2026-01-12"), to: civil("2026-01-27") },
      })
    );

    const times = slots.map((s) => s.startsAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
    // Trois lundis dans la plage.
    expect(slots).toHaveLength(9);
  });
});

/**
 * Le cas signalé en usage réel : un pas égal à la durée fait repartir la
 * grille du début de chaque plage libre, donc toute la journée se décale du
 * battement dès la première réservation.
 */
describe("pas de grille après une réservation", () => {
  const monday9to13 = {
    rules: [{ weekday: 1, startMinute: 9 * 60, endMinute: 13 * 60 }],
    busy: [{ startsAt: wall("2026-01-12", "09:00"), endsAt: wall("2026-01-12", "10:00") }],
    bufferMin: 30,
  };

  it("décale toute la journée quand le pas vaut la durée", () => {
    const slots = computeAvailableSlots(baseInput(monday9to13));

    // La plage libre commence à 10h30 (10h + 30 min de battement), et les
    // créneaux jointifs enchaînent de là : 11h est libre mais jamais proposé.
    expect(asWallClock(slots)).toEqual(["10:30", "11:30"]);
  });

  it("garde les heures rondes avec un pas de 30 min", () => {
    const slots = computeAvailableSlots(
      baseInput({ ...monday9to13, granularityMin: 30 })
    );

    expect(asWallClock(slots)).toEqual(["10:30", "11:00", "11:30", "12:00"]);
  });

  it("ne propose jamais un créneau qui empiète sur le battement", () => {
    const slots = computeAvailableSlots(
      baseInput({ ...monday9to13, granularityMin: 15 })
    );

    // 10h15 + 60 min chevaucherait la fin du battement à 10h30.
    expect(asWallClock(slots)[0]).toBe("10:30");
    // Et rien ne dépasse la fin de la plage.
    expect(asWallClock(slots).at(-1)).toBe("12:00");
  });
});
