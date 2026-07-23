import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { runReminders } from "@/lib/reminders/run";

/**
 * Déclencheur des rappels avant cours.
 *
 * Un point d'entrée HTTP plutôt qu'un ordonnanceur intégré : rien dans une
 * application Next ne survit entre deux requêtes, et un `setInterval` dans un
 * module serveur ne tournerait ni de façon fiable ni une seule fois si
 * plusieurs instances sont déployées. Cette route se branche donc sur ce que
 * l'hébergeur propose — Vercel Cron, une GitHub Action, un `curl` dans une
 * crontab — sans que le code en dépende.
 *
 * Toutes les quinze minutes ou toutes les heures : peu importe. La fenêtre est
 * rattrapable et l'unicité en base empêche les doublons, donc la fréquence ne
 * règle que la fraîcheur.
 *
 * ## Authentification
 *
 * `CRON_SECRET` en en-tête. Sans lui la route est publique, et n'importe qui
 * pourrait la marteler — ce qui ne produirait pas de doublons (l'unicité tient)
 * mais ferait tourner la requête en boucle. **Elle refuse donc de s'exécuter
 * tant que la variable n'est pas définie** : une route de tâche planifiée
 * silencieusement ouverte est pire qu'une route en panne, parce qu'elle ne se
 * remarque pas.
 *
 * `Authorization: Bearer` est le format qu'envoie Vercel Cron ; on accepte
 * aussi `x-cron-secret`, plus simple à poser dans un `curl`.
 */

export async function POST() {
  return handle();
}

/**
 * `GET` aussi : plusieurs ordonnanceurs, dont Vercel Cron, ne savent émettre
 * que celui-là. La route ne modifie que sa propre table de traces.
 */
export async function GET() {
  return handle();
}

async function handle() {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    console.error("[CRON] CRON_SECRET non défini : rappels désactivés");
    return NextResponse.json(
      { error: "Tâche non configurée" },
      { status: 503 }
    );
  }

  const received = await readSecret();

  if (received !== secret) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const run = await runReminders();

    if (run.candidates > 0) {
      console.info(
        `[CRON] rappels — ${run.sent} envoyé(s), ${run.failed} à réessayer, ${run.skipped} déjà pris`
      );
    }

    return NextResponse.json(run);
  } catch (error) {
    console.error("[CRON_REMINDERS_ERROR]", error);
    // 500 assumé : un ordonnanceur qui retente est exactement ce qu'on veut,
    // puisque le traitement est idempotent.
    return NextResponse.json({ error: "Échec des rappels" }, { status: 500 });
  }
}

async function readSecret(): Promise<string | null> {
  const list = await headers();
  const authorization = list.get("authorization");

  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice(7);
  }

  return list.get("x-cron-secret");
}
