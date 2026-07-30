/**
 * Âge révolu à une date donnée.
 *
 * `birthDate` vient d'une colonne `@db.Date`, rendue par Prisma à minuit UTC :
 * on la lit donc en UTC. La lire en heure locale du serveur décalerait la date
 * d'un jour pour tout fuseau derrière Greenwich, et ferait basculer d'âge les
 * personnes nées un jour de leur anniversaire.
 *
 * Module neutre (ni élève ni prof) : le profil élève et la fiche prof publique
 * calculent l'âge de la même façon, une seule implémentation pour les deux.
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
