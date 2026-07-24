"use client";

import { useState } from "react";
import { EyeOff, Flag, Loader2, MessageSquare } from "lucide-react";

import { FormFailure } from "@/components/form-failure";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Stars } from "@/components/ui/stars";
import { postJson, type Failure } from "@/lib/http/failure";
import { REPORT_REASONS } from "@/lib/reviews/report";

/**
 * Avis reçus par le prof, avec droit de réponse et signalement.
 *
 * Le prof ne peut ni modifier ni supprimer un avis — l'écran ne propose donc
 * que répondre ou signaler. C'est délibéré : une note que le noté peut effacer
 * ne vaut rien pour l'élève qui la lit. La réponse publique est la contrepartie
 * honnête ; le signalement est le recours quand l'avis dépasse la critique, et
 * il ne masque rien de lui-même — c'est un tiers qui tranche.
 */

export type TeacherReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  reply: string | null;
  studentName: string | null;
  instrumentName: string;
  lessonAt: string;
  publishedAt: string;
  report: { resolved: boolean } | null;
  hidden: boolean;
};

export function TeacherReviewReplies({
  initial,
  timezone,
}: {
  initial: TeacherReviewRow[];
  timezone: string;
}) {
  const [rows, setRows] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [reporting, setReporting] = useState<string | null>(null);
  const [reason, setReason] = useState<string>(REPORT_REASONS[0].value);
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Failure | null>(null);

  const open = (row: TeacherReviewRow) => {
    setEditing(row.id);
    setReporting(null);
    setDraft(row.reply ?? "");
    setError(null);
  };

  const openReport = (row: TeacherReviewRow) => {
    setReporting(row.id);
    setEditing(null);
    setReason(REPORT_REASONS[0].value);
    setDetail("");
    setError(null);
  };

  const save = async (id: string) => {
    setBusy(true);
    setError(null);

    try {
      const result = await postJson<{ reply: string | null }>(
        `/api/reviews/${id}`,
        { method: "PATCH", body: JSON.stringify({ reply: draft }) }
      );

      if (!result.ok) {
        setError(result.failure);
        return;
      }

      setRows((current) =>
        current.map((row) =>
          row.id === id ? { ...row, reply: result.data.reply } : row
        )
      );
      setEditing(null);
    } finally {
      setBusy(false);
    }
  };

  const submitReport = async (id: string) => {
    setBusy(true);
    setError(null);

    try {
      const result = await postJson<{ id: string }>(
        `/api/reviews/${id}/report`,
        {
          method: "POST",
          body: JSON.stringify({
            reason,
            detail: detail.trim() || undefined,
          }),
        }
      );

      if (!result.ok) {
        setError(result.failure);
        return;
      }

      setRows((current) =>
        current.map((row) =>
          row.id === id ? { ...row, report: { resolved: false } } : row
        )
      );
      setReporting(null);
    } finally {
      setBusy(false);
    }
  };

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-white p-8 text-center text-muted">
        Vous n&apos;avez pas encore reçu d&apos;avis. Ils apparaîtront ici dès
        qu&apos;un élève en laissera un, après un cours que vous aurez clôturé.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <FormFailure failure={error} />

      {rows.map((row) => (
        <article
          key={row.id}
          className="flex flex-col gap-3 rounded-lg border border-border bg-white p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Stars value={row.rating} />
              <span className="text-sm font-medium">
                {row.studentName ?? "Élève"}
              </span>
              <span className="text-sm text-subtle">
                {`· ${row.instrumentName} · ${new Date(
                  row.lessonAt
                ).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  timeZone: timezone,
                })}`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {row.hidden ? (
                <Badge variant="secondary">
                  <EyeOff className="mr-1 h-3 w-3" />
                  Masqué
                </Badge>
              ) : null}
              {row.report ? (
                <Badge variant={row.report.resolved ? "secondary" : "warning"}>
                  <Flag className="mr-1 h-3 w-3" />
                  {row.report.resolved ? "Signalement examiné" : "Signalé"}
                </Badge>
              ) : null}
            </div>
          </div>

          {row.comment ? (
            <p className="whitespace-pre-line text-muted">{row.comment}</p>
          ) : (
            <p className="text-sm text-subtle">Note sans commentaire.</p>
          )}

          {editing === row.id ? (
            <div className="flex flex-col gap-2">
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="Votre réponse, visible publiquement sous l'avis."
              />
              <div className="flex gap-2">
                <Button size="sm" disabled={busy} onClick={() => save(row.id)}>
                  {busy ? (
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  ) : null}
                  {/* Vider le champ retire la réponse : pas besoin d'un bouton
                      « supprimer » pour un seul champ de texte. */}
                  {draft.trim() ? "Publier la réponse" : "Retirer ma réponse"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setEditing(null)}
                >
                  Annuler
                </Button>
              </div>
            </div>
          ) : reporting === row.id ? (
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3">
              <div>
                <p className="text-sm font-medium">Signaler cet avis</p>
                <p className="mt-1 text-sm text-muted">
                  Le signalement ne retire pas l&apos;avis : il le transmet à la
                  modération, qui décide. Un désaccord avec la note n&apos;est
                  pas un motif — pour cela, répondez publiquement.
                </p>
              </div>

              <fieldset className="flex flex-col gap-2">
                <legend className="sr-only">Motif du signalement</legend>
                {REPORT_REASONS.map((entry) => (
                  <label
                    key={entry.value}
                    className="flex items-start gap-2 text-sm"
                  >
                    <input
                      type="radio"
                      name={`reason-${row.id}`}
                      value={entry.value}
                      checked={reason === entry.value}
                      onChange={() => setReason(entry.value)}
                      className="mt-0.5 accent-primary"
                    />
                    <span>{entry.label}</span>
                  </label>
                ))}
              </fieldset>

              <Textarea
                value={detail}
                onChange={(event) => setDetail(event.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="Précision facultative, à l'attention de la modération."
              />

              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => submitReport(row.id)}
                >
                  {busy ? (
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  ) : (
                    <Flag className="mr-2 h-3 w-3" />
                  )}
                  Envoyer le signalement
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setReporting(null)}
                >
                  Annuler
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {row.reply ? (
                <div className="ml-4 border-l-2 border-border pl-3">
                  <p className="text-sm font-medium">Votre réponse</p>
                  <p className="whitespace-pre-line text-sm text-muted">
                    {row.reply}
                  </p>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => open(row)}>
                  <MessageSquare className="mr-2 h-3 w-3" />
                  {row.reply ? "Modifier ma réponse" : "Répondre"}
                </Button>
                {/* Un avis déjà signalé ne se signale pas deux fois : la
                    contrainte d'unicité le refuserait, autant ne pas le
                    proposer. */}
                {row.report ? null : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openReport(row)}
                  >
                    <Flag className="mr-2 h-3 w-3" />
                    Signaler
                  </Button>
                )}
              </div>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
