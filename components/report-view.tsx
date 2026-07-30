import { FileText } from "lucide-react";

import { SectionTitle } from "@/components/editorial";
import { MessageThread, type MessageView } from "@/components/message-thread";

export type ReportView = {
  content: string | null;
  attachments: {
    id: string;
    filename: string;
    contentType: string;
    kind: "IMAGE" | "SCORE" | "AUDIO";
    sizeBytes: number;
  }[];
  comments: MessageView[];
};

/**
 * Compte rendu vu par l'élève, en lecture seule.
 *
 * Les pièces jointes sont servies par la route d'accès (qui vérifie que
 * l'appelant est participant) : l'`src` pointe dessus, jamais sur l'objet privé
 * en direct. Images en aperçu, audio jouable, partition téléchargeable.
 */
export function ReportViewer({
  bookingId,
  report,
  me,
}: {
  bookingId: string;
  report: ReportView;
  /** Rôle du lecteur, pour aligner ses propres messages. */
  me: "TEACHER" | "STUDENT";
}) {
  const base = `/api/bookings/${bookingId}/report/attachments`;

  return (
    <div className="flex flex-col gap-3 rounded-md bg-surface p-3">
      <SectionTitle>Compte rendu du cours</SectionTitle>

      {report.content ? (
        <p className="whitespace-pre-line text-sm text-foreground">
          {report.content}
        </p>
      ) : null}

      {report.attachments.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {report.attachments.map((a) => {
            const src = `${base}/${a.id}`;

            if (a.kind === "IMAGE") {
              return (
                <a key={a.id} href={src} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={a.filename}
                    className="h-24 w-24 rounded-md border border-border object-cover"
                  />
                </a>
              );
            }

            if (a.kind === "AUDIO") {
              return <audio key={a.id} controls src={src} className="h-10 w-56" />;
            }

            return (
              <a
                key={a.id}
                href={src}
                target="_blank"
                rel="noreferrer"
                className="flex h-24 w-40 flex-col items-center justify-center gap-1 rounded-md border border-border bg-elevated px-2 text-center text-xs text-muted hover:text-foreground"
              >
                <FileText className="h-6 w-6 text-subtle" />
                <span className="line-clamp-2 break-all">{a.filename}</span>
              </a>
            );
          })}
        </div>
      ) : null}

      {/* Échanges autour de ce cours. */}
      <div className="border-t border-border pt-3">
        <MessageThread
          initial={report.comments}
          me={me}
          postUrl={`/api/bookings/${bookingId}/report/comments`}
          emptyLabel="Une question sur ce cours ? Écrivez ici."
        />
      </div>
    </div>
  );
}
