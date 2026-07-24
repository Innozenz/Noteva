import {
  buildReportNotifications,
  type ReportContext,
} from "@/lib/notifications/report";
import { sendNotification } from "@/lib/notifications/send";
import prisma from "@/lib/prisma";

/**
 * Prévient la modération qu'un avis a été signalé.
 *
 * Sépare l'orchestration (qui sont les administrateurs, l'envoi) du contenu,
 * qui est pur et testé dans `lib/notifications/report.ts` — même partage que
 * `lib/reminders/run.ts` face à `buildReminders`.
 *
 * Non attendu, et n'échoue jamais : le signalement est enregistré et visible
 * dans la file que l'e-mail parte ou non. Refuser un signalement parce qu'un
 * fournisseur d'e-mail est en panne serait absurde.
 */
export function notifyReportInBackground(context: ReportContext): void {
  void (async () => {
    try {
      const admins = await prisma.user.findMany({
        where: { role: "ADMIN" },
        select: { email: true },
      });

      if (admins.length === 0) {
        // Pas une erreur : tant que personne n'est administrateur, la file
        // existe sans destinataire. Le dire évite de chercher un e-mail perdu.
        console.info(
          "[REVIEW_REPORT] signalement enregistré, aucun administrateur à prévenir"
        );
        return;
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

      const notifications = buildReportNotifications(
        admins.map((admin) => admin.email),
        context,
        appUrl
      );

      for (const notification of notifications) {
        const result = await sendNotification(notification);

        if (!result.ok) {
          console.error(
            `[REVIEW_REPORT] échec vers ${notification.to} : ${result.error}`
          );
        }
      }
    } catch (error) {
      console.error("[REVIEW_REPORT] notification impossible", error);
    }
  })();
}