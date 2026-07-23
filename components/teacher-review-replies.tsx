"use client";

import { useState } from "react";
import { Loader2, MessageSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Stars } from "@/components/ui/stars";

/**
 * Avis reçus par le prof, avec droit de réponse.
 *
 * Le prof ne peut ni modifier ni supprimer un avis — l'écran ne propose donc
 * que répondre. C'est délibéré : une note que le noté peut effacer ne vaut rien
 * pour l'élève qui la lit, et la réponse publique est la contrepartie honnête.
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = (row: TeacherReviewRow) => {
    setEditing(row.id);
    setDraft(row.reply ?? "");
    setError(null);
  };

  const save = async (id: string) => {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/reviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply: draft }),
      });

      const body = await response.json();

      if (!response.ok) {
        setError(body?.error ?? "Impossible d'enregistrer la réponse");
        return;
      }

      setRows((current) =>
        current.map((row) => (row.id === id ? { ...row, reply: body.reply } : row))
      );
      setEditing(null);
    } catch {
      setError("Impossible de contacter le serveur");
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
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {rows.map((row) => (
        <article
          key={row.id}
          className="flex flex-col gap-3 rounded-lg border border-border bg-white p-4"
        >
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
              <div>
                <Button size="sm" variant="outline" onClick={() => open(row)}>
                  <MessageSquare className="mr-2 h-3 w-3" />
                  {row.reply ? "Modifier ma réponse" : "Répondre"}
                </Button>
              </div>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
