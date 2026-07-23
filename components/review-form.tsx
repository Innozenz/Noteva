"use client";

import { useState } from "react";
import { Loader2, Star } from "lucide-react";

import { FormFailure } from "@/components/form-failure";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { postJson, type Failure } from "@/lib/http/failure";
import { cn } from "@/lib/utils";

/**
 * Dépôt d'un avis sur un cours terminé.
 *
 * Le choix de la note est un groupe de boutons radio natifs, pas une rangée de
 * `<div>` cliquables : la notation au clavier et l'annonce par un lecteur
 * d'écran viennent alors gratuitement, et c'est le genre de composant qu'on ne
 * réimplémente jamais correctement à la main.
 *
 * Le commentaire est facultatif — exiger un texte ferait surtout baisser le
 * nombre d'avis.
 */

const LABELS: Record<number, string> = {
  1: "Très déçu",
  2: "Décevant",
  3: "Correct",
  4: "Très bien",
  5: "Excellent",
};

export function ReviewForm({
  bookingId,
  onDone,
}: {
  bookingId: string;
  onDone: (review: { rating: number; comment: string | null }) => void;
}) {
  const [rating, setRating] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Failure | null>(null);

  const shown = hovered ?? rating;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (rating === null) return;

    setBusy(true);
    setError(null);

    try {
      const result = await postJson<{ rating: number; comment: string | null }>(
        "/api/reviews",
        {
          method: "POST",
          body: JSON.stringify({
            bookingId,
            rating,
            comment: comment.trim() || undefined,
          }),
        }
      );

      if (!result.ok) {
        setError(result.failure);
        return;
      }

      onDone({ rating: result.data.rating, comment: result.data.comment });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-md bg-surface p-4"
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Votre avis sur ce cours</legend>

        <div
          className="flex items-center gap-1"
          onMouseLeave={() => setHovered(null)}
        >
          {[1, 2, 3, 4, 5].map((value) => (
            <label
              key={value}
              className="cursor-pointer p-0.5"
              onMouseEnter={() => setHovered(value)}
            >
              <input
                type="radio"
                name={`rating-${bookingId}`}
                value={value}
                checked={rating === value}
                onChange={() => setRating(value)}
                // Masqué visuellement mais toujours focalisable : la tabulation
                // et les flèches parcourent la note comme n'importe quel groupe
                // de boutons radio.
                className="peer sr-only"
              />
              <Star
                className={cn(
                  "h-6 w-6 transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary",
                  shown !== null && value <= shown
                    ? "fill-warning text-warning"
                    : "text-border-strong"
                )}
              />
              <span className="sr-only">{`${value} sur 5 — ${LABELS[value]}`}</span>
            </label>
          ))}

          {shown !== null ? (
            <span className="ml-2 text-sm text-muted">{LABELS[shown]}</span>
          ) : null}
        </div>
      </fieldset>

      <Textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        maxLength={2000}
        rows={3}
        placeholder="Ce qui vous a plu, ce qui pourrait être mieux… (facultatif)"
      />

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={rating === null || busy}>
          {busy ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
          Publier mon avis
        </Button>
        <p className="text-xs text-subtle">
          Publié sur la fiche du prof, avec votre prénom.
        </p>
      </div>

      <FormFailure failure={error} />
    </form>
  );
}
