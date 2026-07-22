/**
 * Arithmétique d'intervalles semi-ouverts [start, end).
 *
 * Les valeurs sont des nombres sans unité : le moteur s'en sert d'abord en
 * minutes locales (au sein d'une journée), puis en millisecondes epoch. Les
 * bornes semi-ouvertes sont ce qui rend un cours de 11h acceptable juste après
 * un cours de 10h-11h — même convention que la contrainte `tstzrange('[)')`
 * côté Postgres.
 */

export type Interval = { start: number; end: number };

/** Trie, fusionne les recouvrements et les intervalles jointifs, jette le vide. */
export function normalize(intervals: Interval[]): Interval[] {
  const sorted = intervals
    .filter((i) => i.end > i.start)
    .sort((a, b) => a.start - b.start);

  const merged: Interval[] = [];

  for (const current of sorted) {
    const last = merged[merged.length - 1];

    if (last && current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

/** Retranche `cuts` de `from`. Les deux entrées peuvent être en désordre. */
export function subtract(from: Interval[], cuts: Interval[]): Interval[] {
  const holes = normalize(cuts);
  let remaining = normalize(from);

  for (const hole of holes) {
    const next: Interval[] = [];

    for (const piece of remaining) {
      // Aucun recouvrement : le morceau survit intact.
      if (piece.end <= hole.start || piece.start >= hole.end) {
        next.push(piece);
        continue;
      }
      if (piece.start < hole.start) {
        next.push({ start: piece.start, end: hole.start });
      }
      if (piece.end > hole.end) {
        next.push({ start: hole.end, end: piece.end });
      }
    }

    remaining = next;
  }

  return remaining;
}

/** Restreint chaque intervalle à `bounds`. */
export function clamp(intervals: Interval[], bounds: Interval): Interval[] {
  return normalize(
    intervals.map((i) => ({
      start: Math.max(i.start, bounds.start),
      end: Math.min(i.end, bounds.end),
    }))
  );
}
