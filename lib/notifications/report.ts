import type { ReportReason } from "@prisma/client";

import { reportReasonLabel } from "@/lib/reviews/report";
import type { Notification } from "./templates";

/**
 * Signalement d'un avis : contenu du message à la modération.
 *
 * Fonction pure, comme `templates.ts` et `reminders.ts` — aucune requête, aucun
 * envoi, donc testable sans base ni fournisseur. L'orchestration (qui sont les
 * administrateurs, l'envoi effectif) vit dans `lib/reviews/report-notify.ts`,
 * de la même façon que `lib/reminders/run.ts` orchestre `buildReminders`.
 *
 * À part de `templates.ts` pour une raison de fond : là-bas le destinataire est
 * l'une des deux parties d'un cours, et la règle est « ne jamais prévenir celui
 * qui vient d'agir ». Ici le destinataire n'est **ni** l'acteur **ni** une
 * partie du cours — c'est la modération, dont le nombre n'est pas connu à
 * l'avance. D'où une liste de destinataires, donc une liste de messages.
 *
 * Sans cet envoi, un signalement n'existerait que pour qui pense à ouvrir la
 * file. C'est la raison qui fait déjà notifier un prof de l'avis qu'il reçoit :
 * un droit dont on n'apprend l'existence que par hasard n'est pas un droit.
 */

export type ReportContext = {
  reason: ReportReason;
  detail: string | null;
  teacherName: string | null;
  instrumentName: string;
  rating: number;
  comment: string | null;
};

export function buildReportNotifications(
  recipients: readonly string[],
  context: ReportContext,
  appUrl: string
): Notification[] {
  const teacher = context.teacherName ?? "Un prof";

  const lines = [
    `${teacher} signale un avis reçu en ${context.instrumentName}.`,
    "",
    `Motif : ${reportReasonLabel(context.reason)}`,
    context.detail ? `Précision : ${context.detail}` : null,
    "",
    `Avis signalé — ${context.rating}/5`,
    context.comment ? `« ${context.comment} »` : "Note sans commentaire.",
    "",
    // L'avis reste en ligne : le signalement n'est pas une suppression, et le
    // dire évite qu'on croie l'affaire déjà réglée.
    "L'avis est toujours en ligne. Il attend une décision dans la file de modération :",
    `${appUrl}/admin/avis`,
  ].filter((line): line is string => line !== null);

  const text = lines.join("\n");

  return recipients.map((to) => ({
    to,
    subject: `Avis signalé — ${context.instrumentName}, ${context.rating}/5`,
    text,
  }));
}