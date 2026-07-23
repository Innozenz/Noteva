import { describe, expect, it } from "vitest";
import { z } from "zod";

import { describeIssues } from "@/lib/http/validation";
import { formatMinute, previewStarts } from "./slot-preview";

const opening = { startMinute: 9 * 60, endMinute: 13 * 60 };

describe("previewStarts", () => {
  it("montre les départs d'un pas rond", () => {
    const preview = previewStarts({ opening, durationMin: 60, stepMin: 60 });

    expect(preview).toEqual({
      kind: "ok",
      starts: ["09:00", "10:00", "11:00", "12:00"],
      total: 4,
    });
  });

  /**
   * La raison d'être de l'aperçu : un pas de 33 est accepté par le moteur et
   * produit des heures qu'aucun élève ne veut lire. Le prof doit le voir avant
   * d'enregistrer, pas après.
   */
  it("rend visible un pas qui produit des heures illisibles", () => {
    const preview = previewStarts({ opening, durationMin: 60, stepMin: 33 });

    expect(preview).toMatchObject({
      kind: "ok",
      starts: ["09:00", "09:33", "10:06", "10:39", "11:12", "11:45"],
      total: 6,
    });
  });

  it("tronque une liste trop longue mais garde le compte", () => {
    const preview = previewStarts({ opening, durationMin: 60, stepMin: 5 });

    expect(preview.kind).toBe("ok");
    if (preview.kind !== "ok") return;
    expect(preview.starts).toHaveLength(8);
    expect(preview.total).toBe(37);
  });

  it("accepte un pas plus grand que la durée", () => {
    const preview = previewStarts({ opening, durationMin: 60, stepMin: 120 });

    expect(preview).toMatchObject({ starts: ["09:00", "11:00"], total: 2 });
  });

  it("signale une plage absente plutôt que de rendre une liste vide", () => {
    expect(previewStarts({ opening: null, durationMin: 60, stepMin: 30 })).toEqual({
      kind: "no_opening",
    });
  });

  /**
   * Le silence trouvé en vérifiant : un cours plus long que l'ouverture rendait
   * zéro créneau sans que rien ne l'explique.
   */
  it("signale un cours qui ne tient pas dans la plage", () => {
    const preview = previewStarts({ opening, durationMin: 480, stepMin: 30 });

    expect(preview).toEqual({ kind: "too_short", openingMinutes: 240 });
  });

  it("ne boucle pas sur un pas nul", () => {
    expect(previewStarts({ opening, durationMin: 60, stepMin: 0 }).kind).toBe(
      "too_short"
    );
  });
});

describe("formatMinute", () => {
  it.each([
    [0, "00:00"],
    [545, "09:05"],
    [639, "10:39"],
    [1439, "23:59"],
  ])("%i → %s", (minute, expected) => {
    expect(formatMinute(minute)).toBe(expected);
  });
});

describe("describeIssues", () => {
  const labels = {
    slotGranularityMin: "Départs de cours toutes les (min)",
    bufferMin: "Battement entre deux cours (min)",
  };

  const issuesFor = (schema: z.ZodTypeAny, value: unknown) => {
    const parsed = schema.safeParse(value);
    if (parsed.success) throw new Error("le schéma aurait dû refuser");
    return parsed.error.issues;
  };

  const schema = z.object({
    slotGranularityMin: z.number().int().min(5).max(240).optional(),
    bufferMin: z.number().int().min(0).max(120).optional(),
  });

  it("nomme le champ et la borne dépassée", () => {
    const message = describeIssues(
      issuesFor(schema, { slotGranularityMin: 1000 }),
      labels
    );

    expect(message).toBe("Départs de cours toutes les (min) : 240 au maximum.");
  });

  it("nomme aussi la borne basse", () => {
    const message = describeIssues(
      issuesFor(schema, { slotGranularityMin: 0 }),
      labels
    );

    expect(message).toBe("Départs de cours toutes les (min) : 5 au minimum.");
  });

  it("cumule les champs fautifs", () => {
    const message = describeIssues(
      issuesFor(schema, { slotGranularityMin: 1000, bufferMin: 500 }),
      labels
    );

    expect(message).toContain("Départs de cours");
    expect(message).toContain("Battement entre deux cours (min) : 120 au maximum.");
  });

  /**
   * Un champ absent du barème ne doit pas produire une phrase bâtie sur son
   * nom technique : mieux vaut la formulation générique.
   */
  it("retombe sur un message générique pour un champ non libellé", () => {
    const other = z.object({ mysteryField: z.number().max(10) });
    const message = describeIssues(issuesFor(other, { mysteryField: 99 }), labels);

    expect(message).toBe("Certaines valeurs ne sont pas valides.");
  });

  it("n'emploie jamais le vocabulaire anglais de Zod", () => {
    const message = describeIssues(
      issuesFor(schema, { slotGranularityMin: 1000 }),
      labels
    );

    expect(message).not.toMatch(/Too big|expected|number/i);
  });
});
