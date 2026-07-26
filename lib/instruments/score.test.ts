import { describe, expect, it } from "vitest";
import type { InstrumentFamily } from "@prisma/client";

import { BARS, NOTES_PER_BAR, buildScore } from "./score";

/**
 * La gravure se voit à l'œil ; ce qui ne se voit pas, ce sont les invariants qui
 * la rendent lisible quelle que soit la donnée. Une plateforme à une seule
 * famille, ou à sept, ne doit pas produire de note hors portée ni de ligature
 * qui traverse une tête.
 */

const MUSIC = { from: 0.14, to: 1 };

describe("buildScore", () => {
  it("ne grave rien quand aucune famille n'est enseignée", () => {
    expect(buildScore([], MUSIC)).toEqual({
      notes: [],
      beams: [],
      barLines: [],
    });
  });

  it("remplit la phrase en reprenant les familles dans l'ordre", () => {
    const families: InstrumentFamily[] = ["VOICE", "KEYBOARD"];
    const { notes } = buildScore(families, MUSIC);

    expect(notes).toHaveLength(BARS * NOTES_PER_BAR);
    // Aucune famille inventée : c'est ce qui fait que la couleur reste une
    // information et non une décoration.
    expect(notes.every((note) => families.includes(note.family))).toBe(true);
    expect(notes.slice(0, 4).map((note) => note.family)).toEqual([
      "VOICE",
      "KEYBOARD",
      "VOICE",
      "KEYBOARD",
    ]);
  });

  it("joue une seule couleur quand une seule famille est enseignée", () => {
    const { notes } = buildScore(["STRINGS"], MUSIC);

    expect(notes).toHaveLength(BARS * NOTES_PER_BAR);
    expect(new Set(notes.map((note) => note.family))).toEqual(
      new Set(["STRINGS"])
    );
  });

  it("garde toutes les notes sur la portée, transposition comprise", () => {
    const all: InstrumentFamily[] = [
      "VOICE",
      "KEYBOARD",
      "STRINGS",
      "WINDS",
      "BRASS",
      "PERCUSSION",
      "ELECTRONIC",
      "THEORY",
    ];

    for (const note of buildScore(all, MUSIC).notes) {
      expect(note.pitch).toBeGreaterThanOrEqual(0);
      expect(note.pitch).toBeLessThanOrEqual(8);
    }
  });

  it("transpose les mesures pour que la phrase ne se répète pas à l'identique", () => {
    const { notes } = buildScore(["VOICE"], MUSIC);

    const perBar = Array.from({ length: BARS }, (_, bar) =>
      notes.filter((note) => note.bar === bar).map((note) => note.pitch)
    );

    // Une seule famille : sans transposition, les quatre mesures seraient
    // rigoureusement identiques et la portée ne serait qu'une frise.
    expect(new Set(perBar.map((bar) => bar.join(","))).size).toBeGreaterThan(1);
  });

  it("oriente les hampes d'une même mesure dans le même sens", () => {
    const { notes, beams } = buildScore(
      ["VOICE", "ELECTRONIC", "PERCUSSION"],
      MUSIC
    );

    for (let bar = 0; bar < BARS; bar++) {
      const inBar = notes.filter((note) => note.bar === bar);
      const directions = new Set(inBar.map((note) => note.stemUp));

      // Une ligature ne peut pas relier une hampe montante à une descendante.
      expect(directions.size).toBe(1);
      expect(beams[bar].stemUp).toBe(inBar[0].stemUp);
    }
  });

  it("pose la ligature au-delà de la note la plus éloignée", () => {
    const { notes, beams } = buildScore(
      ["VOICE", "ELECTRONIC", "PERCUSSION", "WINDS"],
      MUSIC
    );

    for (const beam of beams) {
      const inBar = notes.filter(
        (note) => note.at >= beam.from && note.at <= beam.to
      );

      // Sinon la barre traverserait une tête de note.
      for (const note of inBar) {
        if (beam.stemUp) expect(beam.pitch).toBeLessThan(note.pitch);
        else expect(beam.pitch).toBeGreaterThan(note.pitch);
      }
    }
  });

  it("aligne la ligature sur la première et la dernière note de sa mesure", () => {
    const { notes, beams } = buildScore(["VOICE", "BRASS"], MUSIC);

    expect(beams).toHaveLength(BARS);

    beams.forEach((beam, bar) => {
      const inBar = notes.filter((note) => note.bar === bar);
      expect(beam.from).toBeCloseTo(inBar[0].at);
      expect(beam.to).toBeCloseTo(inBar[inBar.length - 1].at);
    });
  });

  it("ferme la phrase par une barre finale", () => {
    const { barLines } = buildScore(["VOICE"], MUSIC);

    // Trois barres intérieures pour quatre mesures, plus la barre finale.
    expect(barLines).toHaveLength(BARS);
    expect(barLines.at(-1)).toBeCloseTo(MUSIC.to);
    expect(Math.min(...barLines)).toBeGreaterThan(MUSIC.from);
  });
});
