"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  FileText,
  Loader2,
  Mic,
  Paperclip,
  Send,
  Square,
  X,
} from "lucide-react";

import { AudioPlayer } from "@/components/audio-player";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FILE_ACCEPT, resolveAttachmentType } from "@/lib/reports/attachments";
import { cn } from "@/lib/utils";

export type MessageAttachmentView = {
  id: string;
  filename: string;
  contentType: string;
  kind: "IMAGE" | "SCORE" | "AUDIO";
};

export type MessageView = {
  id: string;
  sender: "TEACHER" | "STUDENT";
  content: string;
  createdAt: string;
  attachments?: MessageAttachmentView[];
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

type Staged = { file: File; kind: "IMAGE" | "SCORE" | "AUDIO"; url: string };

/**
 * Fil d'échanges asynchrone, réutilisable.
 *
 * Sert les deux usages : commentaires sous un compte rendu et fil général du
 * couple — seule l'URL de publication change. Pas de temps réel : on ajoute le
 * message envoyé à la liste et on rafraîchit. `me` aligne mes propres messages
 * à droite. Un message peut porter une pièce jointe (image, partition ou note
 * audio enregistrée au micro) en plus ou à la place du texte ; elle part dans le
 * bucket privé et s'affiche via la route d'accès qui vérifie le participant.
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
  const [staged, setStaged] = useState<Staged | null>(null);
  const [recording, setRecording] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  const clearStaged = () => {
    setStaged((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
  };

  const stage = (file: File) => {
    const type = resolveAttachmentType(file.type);
    if (!type) {
      setError("Type de fichier non supporté (image, PDF ou audio).");
      return;
    }
    if (file.size > type.maxBytes) {
      setError(
        `Fichier trop lourd : ${Math.round(type.maxBytes / (1024 * 1024))} Mo au maximum.`
      );
      return;
    }
    setError(null);
    clearStaged();
    setStaged({ file, kind: type.kind, url: URL.createObjectURL(file) });
  };

  const onPickFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) stage(file);
  };

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunks, { type });
        const ext = type.includes("ogg") ? "ogg" : "webm";
        stage(new File([blob], `note-audio-${Date.now()}.${ext}`, { type }));
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setError(
        "Micro inaccessible. Autorisez l'accès au microphone dans le navigateur."
      );
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  const send = async () => {
    const content = text.trim();
    if (!content && !staged) return;

    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("content", content);
      if (staged) body.append("file", staged.file);

      const res = await fetch(postUrl, { method: "POST", body });
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
      clearStaged();
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
            const attachments = msg.attachments ?? [];
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
                    "flex max-w-[80%] flex-col gap-2 rounded-lg px-3 py-2 text-sm",
                    mine ? "bg-primary-soft" : "bg-surface"
                  )}
                >
                  {msg.content ? (
                    <p className="whitespace-pre-line">{msg.content}</p>
                  ) : null}
                  {attachments.map((a) => (
                    <Attachment
                      key={a.id}
                      attachment={a}
                      src={`/api/messages/${msg.id}/attachments/${a.id}`}
                    />
                  ))}
                </div>
                <span className="px-1 text-xs text-subtle">
                  {formatWhen(msg.createdAt)}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {/* Pièce jointe en attente d'envoi */}
      {staged ? (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2">
          {staged.kind === "IMAGE" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={staged.url}
              alt={staged.file.name}
              className="h-14 w-14 shrink-0 rounded-md border border-border object-cover"
            />
          ) : staged.kind === "AUDIO" ? (
            <AudioPlayer src={staged.url} className="min-w-0 flex-1" />
          ) : (
            <span className="flex min-w-0 flex-1 items-center gap-2 text-sm">
              <FileText className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate">{staged.file.name}</span>
            </span>
          )}
          <button
            type="button"
            onClick={clearStaged}
            aria-label="Retirer la pièce jointe"
            className="shrink-0 rounded-full border border-border bg-elevated p-1 text-muted hover:text-danger"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {/* Zone de saisie pleine largeur, actions en dessous. Aligner le champ et
          les boutons sur une seule ligne écrasait le champ sur un téléphone. */}
      <div className="flex flex-col gap-2">
        <Textarea
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Écrire un message…"
          className="resize-y"
        />

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Joindre une image ou une partition"
            disabled={busy || recording}
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          {recording ? (
            <Button
              type="button"
              variant="destructive"
              size="icon"
              aria-label="Arrêter l'enregistrement"
              onClick={stopRecording}
            >
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Enregistrer une note audio"
              disabled={busy}
              onClick={startRecording}
            >
              <Mic className="h-4 w-4" />
            </Button>
          )}

          {recording ? (
            <span className="flex items-center gap-1.5 text-sm text-danger">
              <span className="h-2 w-2 animate-pulse rounded-full bg-danger" />
              Enregistrement…
            </span>
          ) : null}

          <Button
            className="ml-auto"
            disabled={busy || recording || (!text.trim() && !staged)}
            onClick={send}
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Envoyer
          </Button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept={FILE_ACCEPT}
          className="hidden"
          onChange={onPickFile}
        />
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}

/** Rend une pièce jointe reçue : miniature, lecteur audio ou document. */
function Attachment({
  attachment,
  src,
}: {
  attachment: MessageAttachmentView;
  src: string;
}) {
  if (attachment.kind === "IMAGE") {
    return (
      <a href={src} target="_blank" rel="noreferrer" className="block w-fit">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={attachment.filename}
          className="max-h-48 max-w-full rounded-md border border-border object-cover"
        />
      </a>
    );
  }
  if (attachment.kind === "AUDIO") {
    return (
      <div className="flex w-56 max-w-full items-center gap-2 rounded-md border border-border bg-elevated px-2 py-1.5">
        <Mic className="h-4 w-4 shrink-0 text-subtle" />
        <AudioPlayer src={src} className="min-w-0 flex-1" />
      </div>
    );
  }
  return (
    <a
      href={src}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 rounded-md border border-border bg-elevated px-2 py-1.5 text-sm hover:border-border-strong"
    >
      <FileText className="h-4 w-4 shrink-0 text-primary" />
      <span className="min-w-0 flex-1 truncate">{attachment.filename}</span>
      <Download className="h-4 w-4 shrink-0 text-subtle" />
    </a>
  );
}
