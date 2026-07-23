import type { $ZodIssue } from "zod/v4/core";

/**
 * Traduction des erreurs de validation en une phrase utilisable.
 *
 * Les routes rendaient « Paramètres invalides » et joignaient les `issues` de
 * Zod, que rien n'affichait. Le prof qui tapait 1000 dans un champ borné à 240
 * lisait donc un message qui ne nommait ni le champ ni la limite — alors que
 * le serveur les connaissait tous les deux.
 *
 * Les messages de Zod sont en anglais et parlent de types (« Too big: expected
 * number to be <=240 »). On ne les reprend pas : on reconstruit une phrase à
 * partir du champ et de la contrainte, avec le libellé que le prof voit à
 * l'écran. Un message d'erreur qui n'emploie pas les mots de l'interface
 * oblige à deviner de quoi il parle.
 */

export type FieldLabels = Record<string, string>;

export function describeIssues(
  issues: readonly $ZodIssue[],
  labels: FieldLabels
): string {
  const parts: string[] = [];

  for (const issue of issues) {
    const field = String(issue.path[0] ?? "");
    const label = labels[field];

    // Champ inconnu du barème : on ne bricole pas une phrase à partir d'un nom
    // technique, on laisse la formulation générique s'appliquer.
    if (!label) continue;

    parts.push(`${label} : ${constraint(issue)}`);
  }

  return parts.length > 0
    ? parts.join(" ")
    : "Certaines valeurs ne sont pas valides.";
}

function constraint(issue: $ZodIssue): string {
  if (issue.code === "too_big" && issue.maximum != null) {
    return `${issue.maximum} au maximum.`;
  }

  if (issue.code === "too_small" && issue.minimum != null) {
    return `${issue.minimum} au minimum.`;
  }

  if (issue.code === "invalid_type") {
    return "valeur attendue.";
  }

  return "valeur invalide.";
}