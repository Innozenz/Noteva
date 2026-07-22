/**
 * Conditions de publication d'une fiche prof.
 *
 * Fonction pure et testée à part : c'est la même règle qui alimente le
 * formulaire (« il vous manque ceci ») et qui garde la route de publication.
 * Les dupliquer, c'est se garantir qu'elles divergent.
 *
 * Ne traite QUE la complétude de la fiche. La visibilité effective ajoute
 * l'abonnement en cours, vérifié à la lecture — une fiche peut être
 * légitimement PUBLISHED et invisible parce que l'abonnement a expiré.
 */

export type PublishableProfile = {
  headline: string | null;
  bio: string | null;
  hourlyRateCents: number | null;
  teachesOnline: boolean;
  teachesInPerson: boolean;
  teachesAtHome: boolean;
  city: string | null;
  instrumentCount: number;
  availabilityRuleCount: number;
};

export type PublishRequirement = {
  field: string;
  message: string;
};

export type PublishCheck = {
  ok: boolean;
  missing: PublishRequirement[];
};

const MIN_BIO_LENGTH = 80;

export function checkPublishable(profile: PublishableProfile): PublishCheck {
  const missing: PublishRequirement[] = [];

  if (!profile.headline?.trim()) {
    missing.push({
      field: "headline",
      message: "Ajoutez une accroche : c'est la première ligne que voit un élève.",
    });
  }

  const bio = profile.bio?.trim() ?? "";

  if (bio.length < MIN_BIO_LENGTH) {
    missing.push({
      field: "bio",
      message: `Décrivez votre approche en ${MIN_BIO_LENGTH} caractères minimum (${bio.length} pour l'instant).`,
    });
  }

  if (profile.hourlyRateCents === null || profile.hourlyRateCents <= 0) {
    missing.push({
      field: "hourlyRateCents",
      message: "Indiquez votre tarif horaire.",
    });
  }

  if (profile.instrumentCount === 0) {
    missing.push({
      field: "instruments",
      message: "Sélectionnez au moins un instrument enseigné.",
    });
  }

  const hasMode =
    profile.teachesOnline || profile.teachesInPerson || profile.teachesAtHome;

  if (!hasMode) {
    missing.push({
      field: "modes",
      message: "Choisissez au moins une modalité de cours.",
    });
  }

  // Un cours en présentiel sans ville laisse l'élève sans moyen de savoir s'il
  // est concerné, et rend la fiche inexploitable en recherche locale.
  if ((profile.teachesInPerson || profile.teachesAtHome) && !profile.city?.trim()) {
    missing.push({
      field: "city",
      message: "Indiquez votre ville pour les cours en présentiel.",
    });
  }

  // Sans disponibilité, la fiche serait publiée avec un agenda vide : l'élève
  // la trouve, l'ouvre, et ne peut rien réserver.
  if (profile.availabilityRuleCount === 0) {
    missing.push({
      field: "availability",
      message: "Définissez au moins une plage de disponibilité hebdomadaire.",
    });
  }

  return { ok: missing.length === 0, missing };
}
