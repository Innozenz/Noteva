import type { InstrumentFamily } from "@prisma/client";

import { FAMILY_PITCH } from "./family";

/**
 * Gravure de la phrase posée sur la portée de la page d'accueil.
 *
 * Module pur : il ne connaît ni pixels, ni React, ni couleurs. Il rend des
 * fractions (position horizontale) et des demi-interlignes (hauteur), et
 * `app/page.tsx` les multiplie par sa géométrie. C'est ce qui permet de vérifier
 * la gravure sans navigateur.
 *
 * **La couleur reste honnête.** Les notes ne sont pas décoratives : chacune
 * porte une famille réellement enseignée, et la phrase se remplit en
 * **reprenant** ces familles dans l'ordre. Une plateforme qui n'enseigne que la
 * guitare joue donc douze notes d'une seule couleur — beaucoup de notes, une
 * seule famille, ce qui est exactement la vérité. Inventer des familles pour
 * étoffer le motif ferait mentir la légende que constitue le répertoire.
 */

/** Positions sur la portée : 0 = ligne du haut, 8 = ligne du bas. */
const TOP = 0;
const BOTTOM = 8;
const MIDDLE = 4;

/**
 * Quatre mesures de trois croches. Assez pour qu'une phrase se lise, assez peu
 * pour que les têtes ne se touchent pas sur un téléphone.
 */
export const BARS = 4;
export const NOTES_PER_BAR = 3;

/**
 * Transposition de chaque mesure, en demi-interlignes.
 *
 * C'est une **marche** — la même figure reprise plus haut, puis plus bas. Le
 * procédé est le plus vieux moyen d'étirer un motif sans le répéter à
 * l'identique, et c'est lui qui fait entendre une phrase là où la simple
 * répétition ne donnerait qu'une frise.
 */
const BAR_OFFSETS = [0, -2, 1, -1];

/** Longueur de hampe : trois interlignes, comme en gravure. */
const STEM_LENGTH = 6;

export type ScoreNote = {
  family: InstrumentFamily;
  /** Position horizontale, en fraction de la largeur de la portée. */
  at: number;
  /** Hauteur en demi-interlignes depuis la ligne du haut. */
  pitch: number;
  /** Hampe vers le haut (donc vers les hauteurs décroissantes). */
  stemUp: boolean;
  bar: number;
};

export type ScoreBeam = {
  from: number;
  to: number;
  /** Hauteur du bord de la ligature, côté hampes. */
  pitch: number;
  stemUp: boolean;
};

export type Score = {
  notes: ScoreNote[];
  beams: ScoreBeam[];
  /** Barres de mesure, y compris la barre finale. */
  barLines: number[];
};

/**
 * Grave la phrase entre les fractions `from` et `to` de la portée — la clef et
 * le chiffrage occupent ce qui précède.
 */
export function buildScore(
  families: InstrumentFamily[],
  music: { from: number; to: number }
): Score {
  if (families.length === 0) return { notes: [], beams: [], barLines: [] };

  const barWidth = (music.to - music.from) / BARS;

  const notes: ScoreNote[] = [];
  const beams: ScoreBeam[] = [];
  const barLines: number[] = [];

  for (let bar = 0; bar < BARS; bar++) {
    const barStart = music.from + bar * barWidth;
    const offset = BAR_OFFSETS[bar % BAR_OFFSETS.length];

    const inBar: ScoreNote[] = [];

    for (let position = 0; position < NOTES_PER_BAR; position++) {
      const family =
        families[(bar * NOTES_PER_BAR + position) % families.length];

      inBar.push({
        family,
        bar,
        at: barStart + ((position + 0.5) / NOTES_PER_BAR) * barWidth,
        // Le pincement garde la note sur la portée : au-delà, il faudrait des
        // lignes supplémentaires, et une ligne supplémentaire mal placée est
        // ce qui distingue une partition d'un motif qui y ressemble.
        pitch: clamp(FAMILY_PITCH[family] + offset),
        stemUp: true,
      });
    }

    // Le sens des hampes se décide pour la mesure entière : une ligature ne
    // peut pas relier une hampe montante à une hampe descendante. La règle de
    // gravure — hampe du côté opposé au centre — s'applique donc à la moyenne.
    const mean =
      inBar.reduce((total, note) => total + note.pitch, 0) / inBar.length;
    const stemUp = mean > MIDDLE;

    for (const note of inBar) note.stemUp = stemUp;

    // La ligature se pose au bout de la hampe de la note la plus éloignée,
    // sinon elle couperait une tête.
    const reach = stemUp
      ? Math.min(...inBar.map((note) => note.pitch)) - STEM_LENGTH
      : Math.max(...inBar.map((note) => note.pitch)) + STEM_LENGTH;

    notes.push(...inBar);
    beams.push({
      from: inBar[0].at,
      to: inBar[inBar.length - 1].at,
      pitch: reach,
      stemUp,
    });

    if (bar > 0) barLines.push(barStart);
  }

  barLines.push(music.to);

  return { notes, beams, barLines };
}

function clamp(pitch: number): number {
  return Math.min(BOTTOM, Math.max(TOP, pitch));
}
