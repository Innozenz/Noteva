import { describe, expect, it } from "vitest";

import {
  checkReviewable,
  isValidRating,
  REVIEW_WINDOW_DAYS,
  type ReviewableBooking,
} from "./eligibility";
import {
  distribution,
  formatAverage,
  summarize,
  summarizeFromCounts,
} from "./summary";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const base: ReviewableBooking = {
  status: "COMPLETED",
  endsAt: new Date("2026-07-01T10:00:00Z"),
  studentId: "eleve-1",
  hasReview: false,
};

const justAfter = new Date("2026-07-01T11:00:00Z");

describe("checkReviewable", () => {
  it("autorise un cours terminé, non encore noté, dans la fenêtre", () => {
    expect(checkReviewable(base, "eleve-1", justAfter)).toEqual({ ok: true });
  });

  it("refuse un cours qui n'appartient pas à l'élève", () => {
    const result = checkReviewable(base, "eleve-2", justAfter);

    expect(result).toMatchObject({ ok: false, reason: "not_participant" });
  });

  // L'ordre des vérifications est une décision de sécurité, pas un détail :
  // l'appartenance doit primer, sinon la réponse renseigne un tiers sur l'état
  // d'un cours qui ne le regarde pas.
  it("répond « pas le vôtre » avant toute autre raison", () => {
    const result = checkReviewable(
      { ...base, status: "PENDING", hasReview: true },
      "eleve-2",
      justAfter
    );

    expect(result).toMatchObject({ reason: "not_participant" });
  });

  it.each(["PENDING", "CONFIRMED", "CANCELLED", "DECLINED", "NO_SHOW"] as const)(
    "refuse un cours en %s",
    (status) => {
      const result = checkReviewable({ ...base, status }, "eleve-1", justAfter);

      expect(result).toMatchObject({ ok: false, reason: "not_completed" });
    }
  );

  it("refuse un second avis sur le même cours", () => {
    const result = checkReviewable(
      { ...base, hasReview: true },
      "eleve-1",
      justAfter
    );

    expect(result).toMatchObject({ ok: false, reason: "already_reviewed" });
  });

  it("accepte encore au dernier jour de la fenêtre", () => {
    const now = new Date(base.endsAt.getTime() + REVIEW_WINDOW_DAYS * DAY);

    expect(checkReviewable(base, "eleve-1", now)).toEqual({ ok: true });
  });

  it("refuse une fois la fenêtre passée", () => {
    const now = new Date(
      base.endsAt.getTime() + REVIEW_WINDOW_DAYS * DAY + 1000
    );

    expect(checkReviewable(base, "eleve-1", now)).toMatchObject({
      reason: "window_closed",
    });
  });

  // Un cours clôturé par anticipation ne doit pas ouvrir un avis « dans le
  // futur » — la fenêtre se compte depuis la fin du cours, pas depuis la
  // clôture.
  it("autorise avant même la fin du cours si le prof a clôturé", () => {
    const now = new Date(base.endsAt.getTime() - HOUR);

    expect(checkReviewable(base, "eleve-1", now)).toEqual({ ok: true });
  });
});

describe("isValidRating", () => {
  it.each([1, 2, 3, 4, 5])("accepte %i", (rating) => {
    expect(isValidRating(rating)).toBe(true);
  });

  it.each([0, 6, -1, 2.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "refuse %p",
    (rating) => {
      expect(isValidRating(rating)).toBe(false);
    }
  );
});

describe("summarize", () => {
  it("rend une moyenne nulle sans avis", () => {
    expect(summarize([])).toEqual({ count: 0, average: null });
  });

  it("arrondit au dixième", () => {
    expect(summarize([5, 4, 4])).toEqual({ count: 3, average: 4.3 });
  });

  it("ne perd pas les notes basses", () => {
    expect(summarize([1, 1, 5])).toEqual({ count: 3, average: 2.3 });
  });

  it("donne le même résultat que le calcul par comptage", () => {
    const ratings = [5, 5, 4, 3, 5, 2];
    const counts = [
      { rating: 5, count: 3 },
      { rating: 4, count: 1 },
      { rating: 3, count: 1 },
      { rating: 2, count: 1 },
    ];

    expect(summarizeFromCounts(counts)).toEqual(summarize(ratings));
  });
});

describe("distribution", () => {
  it("rend les cinq lignes, y compris les notes absentes", () => {
    const rows = distribution([
      { rating: 5, count: 3 },
      { rating: 3, count: 1 },
    ]);

    expect(rows.map((r) => r.rating)).toEqual([5, 4, 3, 2, 1]);
    expect(rows.find((r) => r.rating === 4)).toEqual({
      rating: 4,
      count: 0,
      share: 0,
    });
    expect(rows.find((r) => r.rating === 5)?.share).toBe(75);
  });

  it("ne divise pas par zéro", () => {
    expect(distribution([]).every((row) => row.share === 0)).toBe(true);
  });
});

describe("formatAverage", () => {
  it("écrit la virgule française", () => {
    expect(formatAverage(4.8)).toBe("4,8");
  });

  it("garde le dixième d'un entier", () => {
    expect(formatAverage(5)).toBe("5,0");
  });

  it("rend null sans avis", () => {
    expect(formatAverage(null)).toBeNull();
  });
});
