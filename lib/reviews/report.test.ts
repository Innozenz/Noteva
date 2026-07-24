import { describe, expect, it } from "vitest";

import {
  REPORT_REASONS,
  REPORT_REASON_VALUES,
  compareForModeration,
  hasOpenReport,
  moderationRank,
  reportReasonLabel,
  sortForModeration,
  type ModerationOrderable,
} from "./report";

const row = (
  overrides: Partial<ModerationOrderable> = {}
): ModerationOrderable => ({
  createdAt: "2026-07-01T10:00:00.000Z",
  published: true,
  report: null,
  ...overrides,
});

const openReport = (createdAt: string) => ({ createdAt, resolvedAt: null });

describe("motifs de signalement", () => {
  it("expose un libellé français pour chaque valeur de l'enum", () => {
    for (const value of REPORT_REASON_VALUES) {
      const label = reportReasonLabel(value);

      expect(label.length).toBeGreaterThan(0);
      // Le libellé ne doit jamais être l'identifiant technique : c'est ce que
      // lirait le prof dans la liste, et « OFFENSIVE » n'est pas du français.
      expect(label).not.toBe(value);
    }
  });

  it("ne propose pas deux fois le même motif", () => {
    const values = REPORT_REASONS.map((entry) => entry.value);

    expect(new Set(values).size).toBe(values.length);
  });
});

describe("rang dans la file de modération", () => {
  it("place un signalement ouvert avant tout le reste", () => {
    expect(moderationRank(row({ report: openReport("2026-07-02T00:00:00Z") }))).toBe(0);
    expect(moderationRank(row({ published: false }))).toBe(1);
    expect(moderationRank(row())).toBe(2);
  });

  it("garde en tête un avis signalé même s'il est déjà masqué", () => {
    // Sinon le signalement resterait ouvert sans que personne ne le voie : il
    // tomberait dans le rang « masqué », qui n'appelle plus d'action.
    const hiddenAndReported = row({
      published: false,
      report: openReport("2026-07-02T00:00:00Z"),
    });

    expect(moderationRank(hiddenAndReported)).toBe(0);
  });

  it("ne considère plus comme ouvert un signalement traité", () => {
    const resolved = row({
      report: { createdAt: "2026-07-02T00:00:00Z", resolvedAt: "2026-07-03T00:00:00Z" },
    });

    expect(hasOpenReport(resolved)).toBe(false);
    expect(moderationRank(resolved)).toBe(2);
  });
});

describe("ordre de la file", () => {
  it("traite les signalements du plus ancien au plus récent", () => {
    // FIFO à l'intérieur du rang « signalé » : un signalement qu'on laisse
    // vieillir est celui qu'on finit par ne plus voir.
    const recent = row({
      createdAt: "2026-07-05T00:00:00.000Z",
      report: openReport("2026-07-06T00:00:00.000Z"),
    });
    const ancien = row({
      createdAt: "2026-07-01T00:00:00.000Z",
      report: openReport("2026-07-02T00:00:00.000Z"),
    });

    expect(sortForModeration([recent, ancien])).toEqual([ancien, recent]);
  });

  it("montre l'historique du plus récent au plus ancien", () => {
    const ancien = row({ createdAt: "2026-07-01T00:00:00.000Z" });
    const recent = row({ createdAt: "2026-07-09T00:00:00.000Z" });

    expect(sortForModeration([ancien, recent])).toEqual([recent, ancien]);
  });

  it("ordonne les trois rangs : signalé, masqué, puis le reste", () => {
    const normal = row({ createdAt: "2026-07-08T00:00:00.000Z" });
    const masque = row({
      createdAt: "2026-07-07T00:00:00.000Z",
      published: false,
    });
    const signale = row({
      createdAt: "2026-07-01T00:00:00.000Z",
      report: openReport("2026-07-02T00:00:00.000Z"),
    });

    expect(sortForModeration([normal, masque, signale])).toEqual([
      signale,
      masque,
      normal,
    ]);
  });

  it("ne modifie pas le tableau reçu", () => {
    const input = [
      row({ createdAt: "2026-07-01T00:00:00.000Z" }),
      row({ createdAt: "2026-07-09T00:00:00.000Z" }),
    ];
    const copy = [...input];

    sortForModeration(input);

    expect(input).toEqual(copy);
  });

  it("est un ordre total : comparer deux fois donne l'inverse", () => {
    const a = row({ createdAt: "2026-07-01T00:00:00.000Z" });
    const b = row({
      createdAt: "2026-07-02T00:00:00.000Z",
      report: openReport("2026-07-03T00:00:00.000Z"),
    });

    expect(Math.sign(compareForModeration(a, b))).toBe(
      -Math.sign(compareForModeration(b, a))
    );
  });
});
