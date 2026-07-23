/**
 * Règles du profil élève.
 *
 * L'essentiel tient dans une contrainte : une part importante des élèves de
 * musique sont mineurs, et un prof ne peut pas convenir d'un cours avec eux
 * sans joindre un responsable légal. Le schéma prévoit les champs ; c'est ici
 * qu'ils deviennent obligatoires au bon moment.
 */

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
 * Âge révolu à une date donnée.
 *
 * `birthDate` vient d'une colonne `@db.Date`, rendue par Prisma à minuit UTC :
 * on la lit donc en UTC. La lire en heure locale du serveur décalerait la date
 * d'un jour pour tout fuseau derrière Greenwich, et ferait basculer d'âge les
 * élèves nés un jour de leur anniversaire.
 */
export function ageOn(birthDate: Date, now: Date): number {
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();

  const monthDiff = now.getUTCMonth() - birthDate.getUTCMonth();
  const dayDiff = now.getUTCDate() - birthDate.getUTCDate();

  // Anniversaire pas encore passé cette année.
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }

  return age;
}

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
