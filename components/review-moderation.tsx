"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { FormFailure } from "@/components/form-failure";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Stars } from "@/components/ui/stars";
import { postJson, type Failure } from "@/lib/http/failure";

/**
 * File de modération des avis.
 *
 * Deux actions seulement : masquer, réafficher. Le modérateur ne réécrit
 * jamais un avis — corriger les mots de quelqu'un tout en les laissant signés
 * de son prénom serait pire que de masquer.
 *
 * Les avis masqués restent listés, et c'est le point : une modération dont on
 * ne peut pas relire les décisions n'est pas une modération, c'est une
 * disparition.
 */

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
};

export function ReviewModeration({ initial }: { initial: ModerationRow[] }) {
  const [rows, setRows] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<Failure | null>(null);

  const setPublished = async (id: string, published: boolean) => {
    setBusyId(id);
    setError(null);

    try {
      const result = await postJson<{ published: boolean }>(
        `/api/admin/reviews/${id}`,
        { method: "PATCH", body: JSON.stringify({ published }) }
      );

      if (!result.ok) {
        setError(result.failure);
        return;
      }

      setRows((current) =>
        current.map((row) =>
          row.id === id ? { ...row, published: result.data.published } : row
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
                {"· sur "}
                <Link
                  href={`/profs/${row.teacherSlug}`}
                  className="hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {row.teacherName ?? "un prof"}
                </Link>
                {` · ${row.instrumentName} · ${new Date(
                  row.createdAt
                ).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}`}
              </span>
            </div>

            <Badge variant={row.published ? "success" : "secondary"}>
              {row.published ? "En ligne" : "Masqué"}
            </Badge>
          </div>

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

          <div>
            <Button
              size="sm"
              variant="outline"
              disabled={busyId === row.id}
              onClick={() => setPublished(row.id, !row.published)}
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
          </div>
        </article>
      ))}
    </div>
  );
}
