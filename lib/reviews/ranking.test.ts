import { describe, expect, it } from "vitest";

import {
  bayesianScore,
  DEFAULT_SITE_MEAN,
  PRIOR_WEIGHT,
  rankTeachers,
} from "./ranking";
import type { RatingSummary } from "./summary";

const summary = (average: number | null, count: number): RatingSummary => ({
  average,
  count,
});

const teacher = (id: string, publishedAt: string | null = null) => ({
  id,
  publishedAt: publishedAt ? new Date(publishedAt) : null,
});

describe("bayesianScore", () => {
  it("rend la moyenne du site à celui qui n'a aucun avis", () => {
    expect(bayesianScore({ rating: summary(null, 0), siteMean: 4.3 })).toBe(4.3);
  });

  /**
   * Le cas qui justifie tout : sans correction, l'unique 5 passerait devant.
   * C'est la raison pour laquelle le classement par note n'avait pas été
   * activé plus tôt.
   */
  it("place quarante avis à 4,8 devant un seul avis à 5", () => {
    const siteMean = 4.4;

    const isole = bayesianScore({ rating: summary(5, 1), siteMean });
    const etabli = bayesianScore({ rating: summary(4.8, 40), siteMean });

    expect(etabli).toBeGreaterThan(isole);
  });

  it("converge vers la moyenne réelle quand les avis s'accumulent", () => {
    const siteMean = 4;
    const scores = [1, 5, 20, 100, 1000].map((count) =>
      bayesianScore({ rating: summary(4.9, count), siteMean })
    );

    // Croissant et bornée par la vraie moyenne.
    for (let i = 1; i < scores.length; i += 1) {
      expect(scores[i]).toBeGreaterThan(scores[i - 1]);
    }
    expect(scores.at(-1)).toBeLessThan(4.9);
    expect(scores.at(-1)).toBeCloseTo(4.9, 2);
  });

  it("tire aussi vers le haut une mauvaise note isolée", () => {
    const siteMean = 4.5;
    const score = bayesianScore({ rating: summary(1, 1), siteMean });

    // (1×1 + 5×4,5) / 6 ≈ 3,92 : pénalisé, mais pas exécuté sur un seul avis.
    expect(score).toBeGreaterThan(1);
    expect(score).toBeLessThan(siteMean);
  });

  it("applique exactement la formule", () => {
    const score = bayesianScore({ rating: summary(5, 1), siteMean: 4 });

    expect(score).toBeCloseTo((1 * 5 + PRIOR_WEIGHT * 4) / (1 + PRIOR_WEIGHT), 10);
  });

  it("accepte un poids d'a priori explicite", () => {
    const faible = bayesianScore({ rating: summary(5, 1), siteMean: 4, priorWeight: 1 });
    const fort = bayesianScore({ rating: summary(5, 1), siteMean: 4, priorWeight: 50 });

    expect(faible).toBeGreaterThan(fort);
  });

  it("ne divise pas par zéro sur un compte incohérent", () => {
    expect(
      Number.isFinite(bayesianScore({ rating: summary(5, 0), siteMean: 4 }))
    ).toBe(true);
  });
});

describe("rankTeachers", () => {
  it("ordonne par score décroissant", () => {
    const ratings = new Map([
      ["a", summary(4.8, 40)],
      ["b", summary(5, 1)],
      ["c", summary(3, 30)],
    ]);

    const order = rankTeachers(
      [teacher("c"), teacher("b"), teacher("a")],
      ratings,
      4.4
    ).map((t) => t.id);

    expect(order).toEqual(["a", "b", "c"]);
  });

  /**
   * Sans départage, tous les profs sans avis partagent le même score et
   * l'ordre dépend de celui rendu par la base : la pagination pourrait alors
   * répéter un prof et en omettre un autre.
   */
  it("départage les scores égaux par date de publication", () => {
    const order = rankTeachers(
      [
        teacher("ancien", "2026-01-01"),
        teacher("recent", "2026-06-01"),
        teacher("moyen", "2026-03-01"),
      ],
      new Map(),
      4
    ).map((t) => t.id);

    expect(order).toEqual(["recent", "moyen", "ancien"]);
  });

  it("reste déterministe même sans date", () => {
    const input = [teacher("b"), teacher("a"), teacher("c")];

    const first = rankTeachers(input, new Map(), 4).map((t) => t.id);
    const second = rankTeachers([...input].reverse(), new Map(), 4).map((t) => t.id);

    expect(first).toEqual(second);
  });

  /**
   * L'a priori place le nouvel arrivant au milieu, pas en queue : il n'est ni
   * mis en avant ni enterré tant qu'on ne sait rien de lui.
   */
  it("intercale un prof sans avis entre les bons et les mauvais", () => {
    const ratings = new Map([
      ["bon", summary(5, 40)],
      ["mauvais", summary(2, 40)],
    ]);

    const order = rankTeachers(
      [teacher("bon"), teacher("nouveau"), teacher("mauvais")],
      ratings,
      4
    ).map((t) => t.id);

    expect(order).toEqual(["bon", "nouveau", "mauvais"]);
  });

  it("n'oublie personne et ne duplique personne", () => {
    const input = Array.from({ length: 25 }, (_, i) => teacher(`t${i}`));
    const ranked = rankTeachers(input, new Map(), DEFAULT_SITE_MEAN);

    expect(ranked).toHaveLength(25);
    expect(new Set(ranked.map((t) => t.id)).size).toBe(25);
  });
});
