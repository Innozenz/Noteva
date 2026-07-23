import { EMPTY_SUMMARY, type RatingSummary } from "./summary";

/**
 * Classement par note, tempéré par une moyenne bayésienne.
 *
 * Trier sur la moyenne brute est le piège classique : un prof avec **un** avis
 * à 5 passerait devant quarante avis à 4,8. Ce n'est pas une question
 * d'arrondi, c'est une question de preuve — une note isolée ne dit presque
 * rien, et la placer en tête récompense l'absence de recul plutôt que la
 * qualité.
 *
 * La correction consiste à tirer chaque prof vers la moyenne du site,
 * d'autant plus fort qu'il a peu d'avis :
 *
 *     score = (n × moyenne_du_prof + m × moyenne_du_site) / (n + m)
 *
 * `m` se lit comme un nombre d'avis fictifs déjà déposés à la moyenne du site.
 * Avec m = 5, il faut une dizaine d'avis réels pour s'en écarter nettement, et
 * un premier avis à 5 ne fait plus basculer le classement.
 *
 * Conséquence assumée : **un prof sans aucun avis obtient exactement la
 * moyenne du site**, donc une place au milieu. Il n'est ni mis en avant ni
 * enterré, ce qui est le seul traitement honnête tant qu'on ne sait rien de
 * lui — l'ancien tri par date de publication, lui, le plaçait en tête.
 *
 * Fonction pure, sans accès base ni horloge.
 */

/**
 * Poids de l'a priori, en nombre d'avis fictifs.
 *
 * 5 est un compromis : assez pour qu'un avis isolé ne fasse pas la loi, assez
 * peu pour qu'une dizaine d'avis sincères pèsent réellement. C'est un réglage
 * éditorial, pas une constante mathématique — le monter rend le classement
 * plus conservateur.
 */
export const PRIOR_WEIGHT = 5;

/**
 * Moyenne du site utilisée tant qu'aucun avis n'existe.
 *
 * Sa valeur n'a alors aucun effet : tous les profs ont zéro avis, donc tous le
 * même score, et le départage se fait sur la date de publication comme avant.
 */
export const DEFAULT_SITE_MEAN = 4;

export function bayesianScore(input: {
  rating: RatingSummary;
  siteMean: number;
  priorWeight?: number;
}): number {
  const { rating, siteMean, priorWeight = PRIOR_WEIGHT } = input;

  if (rating.average === null || rating.count <= 0) return siteMean;

  return (
    (rating.count * rating.average + priorWeight * siteMean) /
    (rating.count + priorWeight)
  );
}

export type RankableTeacher = {
  id: string;
  /** Départage à score égal — le cas de tous les profs sans avis. */
  publishedAt: Date | null;
};

/**
 * Ordonne des profs par score décroissant.
 *
 * Le départage par date de publication n'est pas cosmétique : sans lui, tous
 * les profs sans avis auraient le même score et l'ordre dépendrait de celui
 * que la base a rendu, donc la pagination pourrait montrer deux fois le même
 * prof et jamais un autre.
 */
export function rankTeachers<T extends RankableTeacher>(
  teachers: T[],
  ratings: Map<string, RatingSummary>,
  siteMean: number
): T[] {
  const scored = teachers.map((teacher) => ({
    teacher,
    score: bayesianScore({
      rating: ratings.get(teacher.id) ?? EMPTY_SUMMARY,
      siteMean,
    }),
  }));

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;

    const dateA = a.teacher.publishedAt?.getTime() ?? 0;
    const dateB = b.teacher.publishedAt?.getTime() ?? 0;
    if (dateB !== dateA) return dateB - dateA;

    // Dernier recours : l'identifiant, pour un ordre total et reproductible.
    return a.teacher.id < b.teacher.id ? -1 : 1;
  });

  return scored.map((entry) => entry.teacher);
}
