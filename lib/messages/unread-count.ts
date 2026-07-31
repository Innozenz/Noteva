import type { Viewer } from "@/lib/messages/inbox";
import prisma from "@/lib/prisma";

/**
 * Nombre de messages non lus, en une seule requête indexée.
 *
 * La pastille lisait jusqu'à 500 lignes pour les compter en mémoire (cf.
 * `countUnread`, qui reste la règle pour l'inbox qui charge déjà les messages).
 * Ici on ne veut qu'un total : un `COUNT` avec jointure sur l'état de lecture,
 * en comparant chaque message à mon propre repère, coûte un résultat d'une ligne
 * plutôt qu'un transfert proportionnel au volume d'échanges.
 *
 * Non lu = fil général (reportId nul), écrit par l'autre participant, postérieur
 * à mon repère (nul = jamais ouvert). `::int` pour éviter un bigint que
 * l'adaptateur ne sait pas désérialiser. Le paramètre est lié (pas d'injection).
 */
export async function messageUnreadCount(
  viewer: Viewer,
  profileId: string
): Promise<number> {
  const rows =
    viewer === "TEACHER"
      ? await prisma.$queryRaw<{ n: number }[]>`
          SELECT COUNT(*)::int AS n
          FROM "message" m
          LEFT JOIN "message_thread_state" s
            ON s."teacherId" = m."teacherId" AND s."studentId" = m."studentId"
          WHERE m."reportId" IS NULL
            AND m."teacherId" = ${profileId}
            AND m."sender" = 'STUDENT'
            AND (s."teacherReadAt" IS NULL OR m."createdAt" > s."teacherReadAt")`
      : await prisma.$queryRaw<{ n: number }[]>`
          SELECT COUNT(*)::int AS n
          FROM "message" m
          LEFT JOIN "message_thread_state" s
            ON s."teacherId" = m."teacherId" AND s."studentId" = m."studentId"
          WHERE m."reportId" IS NULL
            AND m."studentId" = ${profileId}
            AND m."sender" = 'TEACHER'
            AND (s."studentReadAt" IS NULL OR m."createdAt" > s."studentReadAt")`;

  return rows[0]?.n ?? 0;
}
