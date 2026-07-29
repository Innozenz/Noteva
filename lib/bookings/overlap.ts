/**
 * Traduit une violation de contrainte d'exclusion en message métier.
 *
 * Le driver adapter ne remonte pas le SQLSTATE 23P01 tel quel : le **nom** de la
 * contrainte, lui, survit dans l'erreur sérialisée. C'est donc sur lui qu'on
 * s'appuie — d'où l'importance de ne pas renommer `booking_teacher_no_overlap`
 * ni `booking_student_no_overlap` sans mettre à jour cette fonction. Partagé par
 * la création et la reprogrammation, pour qu'il n'existe qu'une seule vérité.
 */
export function overlapConflict(error: unknown): string | null {
  const candidate = error as { meta?: unknown; message?: unknown };
  const blob = `${JSON.stringify(candidate?.meta ?? {})} ${String(candidate?.message ?? "")}`;

  if (blob.includes("booking_teacher_no_overlap")) {
    return "Ce créneau vient d'être pris";
  }

  if (blob.includes("booking_student_no_overlap")) {
    return "Vous avez déjà un cours confirmé sur ce créneau";
  }

  return null;
}
