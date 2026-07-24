import type { ReportReason } from "@prisma/client";

/**
 * Signalement d'un avis.
 *
 * Le prof ne peut ni modifier ni supprimer un avis reçu — c'est ce qui donne
 * sa valeur à la note que lit l'élève. Le signalement est donc son seul
 * recours, et il ne masque rien de lui-même : il remonte l'avis en tête de la
 * file de modération, où un tiers tranche. Le noté ne s'auto-arbitre jamais.
 *
 * Ce module est pur : les libellés et l'ordre de la file s'y testent sans base
 * ni requête. Les libellés sont partagés entre l'écran du prof (qui choisit un
 * motif) et celui du modérateur (qui le lit) — deux listes divergeraient, et le
 * modérateur lirait un motif que le prof n'a pas choisi.
 */

export const REPORT_REASONS = [
  {
    value: "OFFENSIVE",
    label: "Propos injurieux, haineux ou diffamatoires",
  },
  {
    value: "DISHONEST",
    label: "Avis mensonger, sans rapport avec un cours réel",
  },
  {
    value: "PRIVACY",
    label: "Divulgue des informations personnelles",
  },
  {
    value: "SPAM",
    label: "Hors sujet ou publicitaire",
  },
  {
    value: "OTHER",
    label: "Autre",
  },
] as const satisfies ReadonlyArray<{ value: ReportReason; label: string }>;

export const REPORT_REASON_VALUES = REPORT_REASONS.map(
  (reason) => reason.value
) as [ReportReason, ...ReportReason[]];

export function reportReasonLabel(reason: ReportReason): string {
  return (
    REPORT_REASONS.find((entry) => entry.value === reason)?.label ?? "Autre"
  );
}

/**
 * Ce qu'il faut d'un avis pour le placer dans la file. Type structurel : la
 * fonction ne dépend ni de Prisma ni du reste de la ligne, donc elle se teste
 * avec trois champs.
 */
export type ModerationOrderable = {
  createdAt: string;
  published: boolean;
  report: { createdAt: string; resolvedAt: string | null } | null;
};

export function hasOpenReport(row: ModerationOrderable): boolean {
  return row.report !== null && row.report.resolvedAt === null;
}

/**
 * Trois rangs, dans cet ordre :
 *
 * 0. signalement ouvert — une décision est attendue, c'est le seul rang qui
 *    appelle une action ;
 * 1. avis masqué — décision déjà prise, mais qu'on doit pouvoir relire ;
 * 2. le reste.
 *
 * Un avis signalé passe devant même s'il est déjà masqué : le signalement
 * resterait sinon ouvert sans que personne ne le voie.
 */
export function moderationRank(row: ModerationOrderable): number {
  if (hasOpenReport(row)) return 0;
  if (!row.published) return 1;
  return 2;
}

/**
 * À l'intérieur du rang « signalé », le plus ancien d'abord : un signalement
 * qu'on laisse vieillir est celui qu'on finit par ne plus voir. Ailleurs c'est
 * l'inverse — on parcourt un historique, et le récent prime.
 */
export function compareForModeration(
  a: ModerationOrderable,
  b: ModerationOrderable
): number {
  const rankA = moderationRank(a);
  const rankB = moderationRank(b);

  if (rankA !== rankB) return rankA - rankB;

  if (rankA === 0 && a.report && b.report) {
    return a.report.createdAt.localeCompare(b.report.createdAt);
  }

  return b.createdAt.localeCompare(a.createdAt);
}

export function sortForModeration<T extends ModerationOrderable>(
  rows: readonly T[]
): T[] {
  return [...rows].sort(compareForModeration);
}
