/**
 * Aperçu des départs de cours, pour le formulaire du prof.
 *
 * Un pas de 33 minutes « fonctionne » : le moteur avance de 33 en 33 et rend
 * 9:00, 9:33, 10:06… Ce n'est pas une erreur, c'est simplement illisible pour
 * l'élève — et un prof ne peut pas le deviner en tapant un nombre dans un
 * champ. Montrer le résultat vaut mieux que fermer la saisie à une liste : un
 * pas de 20 ou de 45 a du sens, une liste figée les exclurait.
 *
 * Fonction pure, en minutes depuis minuit. Le vrai découpage a lieu en
 * instants — voir lib/availability — ce qui change le nombre de créneaux les
 * deux jours de changement d'heure. L'aperçu ignore ce détail : il montre une
 * journée ordinaire, ce qui est exactement son rôle.
 */

export type SlotPreview =
  | { kind: "ok"; starts: string[]; total: number }
  /** Aucune plage définie : rien à prévisualiser. */
  | { kind: "no_opening" }
  /** La plage existe mais ne peut accueillir aucun cours de cette durée. */
  | { kind: "too_short"; openingMinutes: number };

export function previewStarts(input: {
  /** Ouverture de référence, en minutes depuis minuit local. */
  opening: { startMinute: number; endMinute: number } | null;
  durationMin: number;
  stepMin: number;
  /** Nombre de départs listés avant de tronquer. */
  take?: number;
}): SlotPreview {
  const { opening, durationMin, stepMin, take = 8 } = input;

  if (!opening) return { kind: "no_opening" };

  const span = opening.endMinute - opening.startMinute;

  if (durationMin <= 0 || stepMin <= 0 || span < durationMin) {
    return { kind: "too_short", openingMinutes: Math.max(0, span) };
  }

  const starts: string[] = [];
  let total = 0;

  for (
    let m = opening.startMinute;
    m + durationMin <= opening.endMinute;
    m += stepMin
  ) {
    total += 1;
    if (starts.length < take) starts.push(formatMinute(m));
  }

  return { kind: "ok", starts, total };
}

/** 545 → « 09:05 ». */
export function formatMinute(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;

  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}