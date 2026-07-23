/**
 * Agrégats de notes.
 *
 * La moyenne n'est **pas** stockée sur `TeacherProfile`, par cohérence avec la
 * visibilité : une valeur dénormalisée doit être resynchronisée à chaque
 * écriture, et le jour où une resynchronisation manque, une fiche affiche une
 * note fausse sans que rien ne le signale. Ici le volume est dérisoire — un
 * `groupBy` par page de résultats — donc dériver coûte moins cher que
 * maintenir.
 *
 * Fonctions pures et testées : l'arrondi et le cas « aucun avis » sont
 * exactement les endroits où une erreur passe pour un détail d'affichage
 * jusqu'à ce qu'un prof compte ses étoiles.
 */

export type RatingSummary = {
  count: number;
  /** Moyenne arrondie au dixième. `null` quand il n'y a aucun avis. */
  average: number | null;
};

export const EMPTY_SUMMARY: RatingSummary = { count: 0, average: null };

export function summarize(ratings: number[]): RatingSummary {
  if (ratings.length === 0) return EMPTY_SUMMARY;

  const total = ratings.reduce((sum, rating) => sum + rating, 0);

  return {
    count: ratings.length,
    // Un dixième suffit : afficher 4,33 laisse croire à une précision que
    // douze avis ne portent pas.
    average: Math.round((total / ratings.length) * 10) / 10,
    };
}

/**
 * Même calcul à partir de `groupBy({ by: ["rating"], _count: true })`, pour
 * n'avoir jamais à charger les avis un par un.
 */
export function summarizeFromCounts(
  counts: { rating: number; count: number }[]
): RatingSummary {
  const total = counts.reduce((sum, row) => sum + row.rating * row.count, 0);
  const n = counts.reduce((sum, row) => sum + row.count, 0);

  if (n === 0) return EMPTY_SUMMARY;

  return { count: n, average: Math.round((total / n) * 10) / 10 };
}

/** Répartition 1→5, zéros compris : une barre absente se lit mal. */
export function distribution(
  counts: { rating: number; count: number }[]
): { rating: number; count: number; share: number }[] {
  const total = counts.reduce((sum, row) => sum + row.count, 0);

  return [5, 4, 3, 2, 1].map((rating) => {
    const count = counts.find((row) => row.rating === rating)?.count ?? 0;

    return {
      rating,
      count,
      share: total === 0 ? 0 : Math.round((count / total) * 100),
    };
  });
}

/** « 4,8 » — les avis sont affichés en français, virgule comprise. */
export function formatAverage(average: number | null): string | null {
  return average === null ? null : average.toFixed(1).replace(".", ",");
}
