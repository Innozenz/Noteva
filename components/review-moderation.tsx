"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Eye, EyeOff, Flag, Loader2 } from "lucide-react";

import { FormFailure } from "@/components/form-failure";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Stars } from "@/components/ui/stars";
import { postJson, type Failure } from "@/lib/http/failure";
import { reportReasonLabel } from "@/lib/reviews/report";
import type { ReportReason } from "@prisma/client";

/**
 * File de modération des avis.
 *
 * Deux actions seulement sur l'avis : masquer, réafficher. Le modérateur ne
 * réécrit jamais un avis — corriger les mots de quelqu'un tout en les laissant
 * signés de son prénom serait pire que de masquer.
 *
 * Les avis masqués restent listés, et c'est le point : une modération dont on
 * ne peut pas relire les décisions n'est pas une modération, c'est une
 * disparition. Un signalement traité reste affiché pour la même raison.
 *
 * Un signalement se clôt de deux façons, et les deux sont une réponse : masquer
 * l'avis, ou rejeter le signalement en le laissant en ligne.
 */

export type ModerationReport = {
  reason: ReportReason;
  detail: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

export type ModerationRow = {
  id: string;
  rating: number;
  comment: string | null;
  reply: string | null;
  published: boolean;
  createdAt: string;
  studentName: string | null;
  teacherName: string | null;
  teacherSlug: string;
  instrumentName: string;
  report: ModerationReport | null;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export function ReviewModeration({ initial }: { initial: ModerationRow[] }) {
  const [rows, setRows] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<Failure | null>(null);

  const moderate = async (
    id: string,
    body: { published?: boolean; dismissReport?: boolean }
  ) => {
    setBusyId(id);
    setError(null);

    try {
      const result = await postJson<{
        published: boolean;
        reportResolved: boolean;
      }>(`/api/admin/reviews/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });

      if (!result.ok) {
        setError(result.failure);
        return;
      }

      setRows((current) =>
        current.map((row) =>
          row.id === id
            ? {
                ...row,
                published: result.data.published,
                report:
                  row.report && result.data.reportResolved
                    ? {
                        ...row.report,
                        resolvedAt:
                          row.report.resolvedAt ?? new Date().toISOString(),
                      }
                    : row.report,
              }
            : row
        )
      );
    } finally {
      setBusyId(null);
    }
  };

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-white p-8 text-center text-muted">
        Aucun avis n&apos;a encore été déposé. Ils apparaîtront ici dès
        qu&apos;un élève en laissera un, déjà publiés.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <FormFailure failure={error} />

      {rows.map((row) => {
        const openReport = row.report !== null && row.report.resolvedAt === null;

        return (
          <article
            key={row.id}
            className={`flex flex-col gap-3 rounded-lg border bg-white p-4 ${
              openReport ? "border-warning" : "border-border"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Stars value={row.rating} />
                <span className="text-sm font-medium">
                  {row.studentName ?? "Élève"}
                </span>
                <span className="text-sm text-subtle">
                  {"· sur "}
                  <Link
                    href={`/profs/${row.teacherSlug}`}
                    className="hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {row.teacherName ?? "un prof"}
                  </Link>
                  {` · ${row.instrumentName} · ${formatDate(row.createdAt)}`}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {row.report ? (
                  <Badge variant={openReport ? "warning" : "secondary"}>
                    <Flag className="mr-1 h-3 w-3" />
                    {openReport ? "Signalé" : "Signalement traité"}
                  </Badge>
                ) : null}
                <Badge variant={row.published ? "success" : "secondary"}>
                  {row.published ? "En ligne" : "Masqué"}
                </Badge>
              </div>
            </div>

            {row.report ? (
              <div
                className={`rounded-lg border p-3 ${
                  openReport
                    ? "border-warning bg-warning/5"
                    : "border-border bg-surface"
                }`}
              >
                <p className="text-sm font-medium">
                  {`Signalé par le prof le ${formatDate(row.report.createdAt)}`}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {`Motif : ${reportReasonLabel(row.report.reason)}`}
                </p>
                {row.report.detail ? (
                  <p className="mt-1 whitespace-pre-line text-sm text-muted">
                    {row.report.detail}
                  </p>
                ) : null}
                {row.report.resolvedAt ? (
                  <p className="mt-1 text-sm text-subtle">
                    {`Traité le ${formatDate(row.report.resolvedAt)}.`}
                  </p>
                ) : null}
              </div>
            ) : null}

            {row.comment ? (
              <p className="whitespace-pre-line text-muted">{row.comment}</p>
            ) : (
              <p className="text-sm text-subtle">Note sans commentaire.</p>
            )}

            {row.reply ? (
              <div className="ml-4 border-l-2 border-border pl-3">
                <p className="text-sm font-medium">Réponse du prof</p>
                <p className="whitespace-pre-line text-sm text-muted">
                  {row.reply}
                </p>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={busyId === row.id}
                onClick={() => moderate(row.id, { published: !row.published })}
              >
                {busyId === row.id ? (
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                ) : row.published ? (
                  <EyeOff className="mr-2 h-3 w-3" />
                ) : (
                  <Eye className="mr-2 h-3 w-3" />
                )}
                {row.published ? "Masquer" : "Remettre en ligne"}
              </Button>

              {/* Rejeter, c'est répondre au prof que l'avis reste : sans ce
                  bouton, le seul moyen de vider la file serait de masquer. */}
              {openReport ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busyId === row.id}
                  onClick={() => moderate(row.id, { dismissReport: true })}
                >
                  <Check className="mr-2 h-3 w-3" />
                  Rejeter le signalement
                </Button>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
