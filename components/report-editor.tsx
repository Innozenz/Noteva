"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  FileText,
  Loader2,
  Mic,
  Paperclip,
  Square,
  Trash2,
} from "lucide-react";

import { AudioPlayer } from "@/components/audio-player";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { lessonTitle } from "@/lib/bookings/title";
import { FILE_ACCEPT } from "@/lib/reports/attachments";
import { cn } from "@/lib/utils";

export type ReportAttachmentView = {
  id: string;
  filename: string;
  contentType: string;
  kind: "IMAGE" | "SCORE" | "AUDIO";
  sizeBytes: number;
};

export type ReportEditorLesson = {
  bookingId: string;
  dateLabel: string;
  studentName: string;
  instrumentName: string;
  isTrial: boolean;
  content: string;
  attachments: ReportAttachmentView[];
};

/**
 * Éditeur d'un compte rendu de cours (côté prof).
 *
 * Une carte repliée par cours ; dépliée, elle édite le texte et gère les pièces
 * jointes (images, partitions PDF, notes audio enregistrées au micro). Chaque
 * pièce part vers le bucket privé via la route dédiée, et s'affiche par une URL
 * signée servie par cette même route.
 */
export function ReportEditor({ lesson }: { lesson: ReportEditorLesson }) {
  const router = useRouter();
  const base = `/api/bookings/${lesson.bookingId}/report`;

  const [open, setOpen] = useState(false);
  const [content, setContent] = useState(lesson.content);
  const [saved, setSaved] = useState(lesson.content);
  const [savingContent, setSavingContent] = useState(false);
  const [attachments, setAttachments] = useState(lesson.attachments);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);

  const dirty = content !== saved;
  const documented = saved.trim().length > 0 || attachments.length > 0;

  const saveContent = async () => {
    setSavingContent(true);
    setError(null);
    setJustSaved(false);
    try {
      const res = await fetch(base, {
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
      router.refresh();
    } catch {
      setError("Impossible de joindre le serveur.");
    } finally {
      setSavingContent(false);
    }
  };

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    const body = new FormData();
    body.append("file", file);
    try {
      const res = await fetch(`${base}/attachments`, { method: "POST", body });
      const data = (await res.json().catch(() => null)) as
        | ReportAttachmentView
        | { error?: string }
        | null;
      if (!res.ok || !data || !("id" in data)) {
        setError(
          (data && "error" in data && data.error) || "L'envoi a échoué."
        );
        return;
      }
      setAttachments((list) => [...list, data]);
      router.refresh();
    } catch {
      setError("Impossible de joindre le serveur.");
    } finally {
      setBusy(false);
    }
  };

  const onPickFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) upload(file);
  };

  const removeAttachment = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${base}/attachments/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setError("La suppression a échoué.");
        return;
      }
      setAttachments((list) => list.filter((a) => a.id !== id));
      router.refresh();
    } catch {
      setError("Impossible de joindre le serveur.");
    } finally {
      setBusy(false);
    }
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
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunks, { type });
        const ext = type.includes("ogg") ? "ogg" : "webm";
        await upload(
          new File([blob], `note-audio-${Date.now()}.${ext}`, { type })
        );
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

  return (
    <div className="rounded-lg border border-border bg-elevated">
      {/* En-tête cliquable */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {lessonTitle(lesson.instrumentName, lesson.isTrial)} avec{" "}
            {lesson.studentName}
          </p>
          <p className="truncate text-xs text-muted">{lesson.dateLabel}</p>
        </div>
        <Badge variant={documented ? "success" : "secondary"}>
          {documented ? "Documenté" : "À documenter"}
        </Badge>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open ? (
        <div className="flex flex-col gap-4 border-t border-border px-4 py-4">
          {/* Texte */}
          <div className="flex flex-col gap-2">
            <Textarea
              rows={5}
              value={content}
              placeholder="Ce qui a été travaillé, les points à revoir, les exercices pour la prochaine fois…"
              onChange={(e) => setContent(e.target.value)}
            />
            <div className="flex items-center gap-3">
              <Button size="sm" disabled={!dirty || savingContent} onClick={saveContent}>
                {savingContent ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Enregistrer le texte
              </Button>
              {justSaved && !dirty ? (
                <span className="flex items-center gap-1 text-xs text-success">
                  <Check className="h-3.5 w-3.5" /> Enregistré
                </span>
              ) : null}
            </div>
          </div>

          {/* Pièces jointes */}
          {attachments.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {attachments.map((a) => (
                <AttachmentTile
                  key={a.id}
                  attachment={a}
                  src={`${base}/attachments/${a.id}`}
                  onDelete={() => removeAttachment(a.id)}
                  disabled={busy}
                />
              ))}
            </div>
          ) : null}

          {/* Actions d'ajout */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy || recording}
              onClick={() => fileRef.current?.click()}
            >
              <Paperclip className="mr-2 h-4 w-4" />
              Image ou partition
            </Button>

            {recording ? (
              <Button type="button" variant="destructive" size="sm" onClick={stopRecording}>
                <Square className="mr-2 h-4 w-4" />
                Arrêter l&apos;enregistrement
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={startRecording}
              >
                <Mic className="mr-2 h-4 w-4" />
                Note audio
              </Button>
            )}

            {busy ? <Loader2 className="h-4 w-4 animate-spin text-muted" /> : null}
            {recording ? (
              <span className="flex items-center gap-1.5 text-sm text-danger">
                <span className="h-2 w-2 animate-pulse rounded-full bg-danger" />
                Enregistrement…
              </span>
            ) : null}

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
      ) : null}
    </div>
  );
}

function AttachmentTile({
  attachment,
  src,
  onDelete,
  disabled,
}: {
  attachment: ReportAttachmentView;
  src: string;
  onDelete: () => void;
  disabled: boolean;
}) {
  return (
    <div className="relative flex flex-col gap-1">
      {attachment.kind === "IMAGE" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={attachment.filename}
          className="h-28 w-28 rounded-lg border border-border object-cover"
        />
      ) : attachment.kind === "AUDIO" ? (
        <div className="flex w-64 items-center rounded-lg border border-border bg-elevated px-3 py-3">
          <AudioPlayer src={src} className="min-w-0 flex-1" />
        </div>
      ) : (
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="flex h-28 w-40 flex-col items-center justify-center gap-1 rounded-lg border border-border bg-elevated px-2 text-center text-xs text-muted hover:text-foreground"
        >
          <FileText className="h-6 w-6 text-subtle" />
          <span className="line-clamp-2 break-all">{attachment.filename}</span>
        </a>
      )}
      <button
        type="button"
        onClick={onDelete}
        disabled={disabled}
        aria-label="Supprimer la pièce jointe"
        className="absolute -right-2 -top-2 rounded-full border border-border bg-elevated p-1 text-muted shadow-sm hover:text-danger"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
