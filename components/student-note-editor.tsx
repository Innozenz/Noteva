"use client";

import { useState } from "react";
import { Check, Loader2, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/**
 * Note privée du prof sur un élève.
 *
 * Persistante, propre au couple prof↔élève, jamais vue de l'élève. S'enregistre
 * seule via la route dédiée. Le cadenas et la mention le rappellent.
 */
export function StudentNoteEditor({
  studentId,
  initialContent,
}: {
  studentId: string;
  initialContent: string;
}) {
  const [content, setContent] = useState(initialContent);
  const [saved, setSaved] = useState(initialContent);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const dirty = content !== saved;

  const save = async () => {
    setBusy(true);
    setError(null);
    setJustSaved(false);
    try {
      const res = await fetch(`/api/teacher/students/${studentId}/note`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "L'enregistrement a échoué.");
        return;
      }
      setSaved(content);
      setJustSaved(true);
    } catch {
      setError("Impossible de joindre le serveur.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-1.5 text-xs text-subtle">
        <Lock className="h-3 w-3" />
        Visible par vous seul — jamais par l&apos;élève.
      </p>
      <Textarea
        rows={4}
        value={content}
        placeholder="Points de suivi, préférences, progrès, ce qu'il faut garder en tête pour cet élève…"
        onChange={(e) => setContent(e.target.value)}
      />
      <div className="flex items-center gap-3">
        <Button size="sm" disabled={!dirty || busy} onClick={save}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Enregistrer la note
        </Button>
        {justSaved && !dirty ? (
          <span className="flex items-center gap-1 text-xs text-success">
            <Check className="h-3.5 w-3.5" /> Enregistré
          </span>
        ) : null}
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
