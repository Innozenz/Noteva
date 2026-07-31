"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type MessageView = {
  id: string;
  sender: "TEACHER" | "STUDENT";
  content: string;
  createdAt: string;
};

/** Date + heure d'envoi, dans le fuseau du lecteur. */
function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Fil d'échanges asynchrone, réutilisable.
 *
 * Sert les deux usages : commentaires sous un compte rendu et fil général du
 * couple — seule l'URL de publication change. Pas de temps réel : on ajoute le
 * message envoyé à la liste et on rafraîchit. `me` aligne mes propres messages
 * à droite.
 */
export function MessageThread({
  initial,
  me,
  postUrl,
  emptyLabel,
}: {
  initial: MessageView[];
  me: "TEACHER" | "STUDENT";
  postUrl: string;
  emptyLabel?: string;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    const content = text.trim();
    if (!content) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = (await res.json().catch(() => null)) as
        | MessageView
        | { error?: string }
        | null;

      if (!res.ok || !data || !("id" in data)) {
        setError((data && "error" in data && data.error) || "L'envoi a échoué.");
        return;
      }

      setMessages((list) => [...list, data]);
      setText("");
      router.refresh();
    } catch {
      setError("Impossible de joindre le serveur.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {messages.length === 0 ? (
        <p className="text-sm text-subtle">
          {emptyLabel ?? "Aucun message pour l'instant."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {messages.map((msg) => {
            const mine = msg.sender === me;
            return (
              <li
                key={msg.id}
                className={cn(
                  "flex flex-col gap-0.5",
                  mine ? "items-end" : "items-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] whitespace-pre-line rounded-lg px-3 py-2 text-sm",
                    mine ? "bg-primary-soft" : "bg-surface"
                  )}
                >
                  {msg.content}
                </div>
                <span className="px-1 text-xs text-subtle">
                  {formatWhen(msg.createdAt)}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-end gap-2">
        <Textarea
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Écrire un message…"
          className="flex-1 resize-y"
        />
        <Button
          size="sm"
          aria-label="Envoyer"
          disabled={busy || !text.trim()}
          onClick={send}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
