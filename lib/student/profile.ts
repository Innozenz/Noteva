/**
 * Règles du profil élève.
 *
 * L'essentiel tient dans une contrainte : une part importante des élèves de
 * musique sont mineurs, et un prof ne peut pas convenir d'un cours avec eux
 * sans joindre un responsable légal. Le schéma prévoit les champs ; c'est ici
 * qu'ils deviennent obligatoires au bon moment.
 */

import { ageOn } from "@/lib/user/age";

// Réexporté : l'âge est calculé au même endroit pour l'élève et pour le prof.
export { ageOn };

export const MAJORITY_AGE = 18;

export type GuardianFields = {
  guardianName: string | null;
  guardianEmail: string | null;
  guardianPhone: string | null;
};

export type StudentProfileInput = GuardianFields & {
  birthDate: Date | null;
};

/**
 * Un élève sans date de naissance n'est pas présumé mineur : on ne peut rien
 * en dire, et bloquer par défaut empêcherait tout adulte n'ayant pas renseigné
 * ce champ de réserver.
 */
export function isMinor(birthDate: Date | null, now: Date): boolean {
  if (!birthDate) return false;

  return ageOn(birthDate, now) < MAJORITY_AGE;
}

export type ProfileIssue = { field: string; message: string };

/**
 * Ce qui manque au profil pour être exploitable.
 *
 * Rend une liste plutôt qu'un booléen : le formulaire affiche les manques, et
 * la route applique la même règle. Une seule implémentation pour les deux.
 */
export function checkStudentProfile(
  profile: StudentProfileInput,
  now: Date
): ProfileIssue[] {
  const issues: ProfileIssue[] = [];

  if (!isMinor(profile.birthDate, now)) return issues;

  if (!profile.guardianName?.trim()) {
    issues.push({
      field: "guardianName",
      message: "Nom du responsable légal requis pour un élève mineur.",
    });
  }

  // Un moyen de contact au moins : le prof doit pouvoir joindre quelqu'un.
  // Exiger les deux serait excessif, n'en exiger aucun rendrait le nom inutile.
  if (!profile.guardianEmail?.trim() && !profile.guardianPhone?.trim()) {
    issues.push({
      field: "guardianContact",
      message:
        "E-mail ou téléphone du responsable légal requis pour un élève mineur.",
    });
  }

  return issues;
}

/**
 * Résumé destiné au prof, dans sa boîte de demandes.
 *
 * Ne rend que ce qui aide à décider d'accepter un cours. Le reste du profil
 * ne le regarde pas.
 */
export function guardianSummary(
  profile: StudentProfileInput,
  now: Date
): { isMinor: boolean; age: number | null; contact: string | null } {
  const age = profile.birthDate ? ageOn(profile.birthDate, now) : null;

  if (!isMinor(profile.birthDate, now)) {
    return { isMinor: false, age, contact: null };
  }

  const contact =
    [profile.guardianName, profile.guardianEmail, profile.guardianPhone]
      .filter((part) => part?.trim())
      .join(" · ") || null;

  return { isMinor: true, age, contact };
}
