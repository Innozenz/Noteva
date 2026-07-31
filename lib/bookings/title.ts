/**
 * Intitulé d'un rendez-vous.
 *
 * Afficher le seul nom de l'instrument (« Guitare ») se lit mal — on dirait que
 * l'instrument *est* le nom du cours. « Cours de Guitare » se lit comme un vrai
 * intitulé. Un seul endroit pour cette formulation, refinable ensuite (essai,
 * élision) sans la disperser.
 */
export function lessonTitle(instrumentName: string, isTrial = false): string {
  return `${isTrial ? "Cours d'essai" : "Cours"} de ${instrumentName}`;
}
