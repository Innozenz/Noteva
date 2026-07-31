import { MessageThread, type MessageView } from "@/components/message-thread";

/**
 * Bloc « Échanges » d'un compte rendu : le fil de messages rattaché au cours.
 *
 * Partagé par la vue en lecture (`ReportViewer`, côté élève) et l'éditeur
 * (`ReportEditor`, côté prof) pour qu'il n'en existe qu'une seule
 * implémentation — le fil, son URL d'envoi et son état vide ne doivent pas
 * diverger entre les deux surfaces.
 */
export function ReportComments({
  bookingId,
  comments,
  me,
}: {
  bookingId: string;
  comments: MessageView[];
  /** Rôle du lecteur, pour aligner ses propres messages. */
  me: "TEACHER" | "STUDENT";
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      <p className="text-xs font-medium uppercase tracking-wide text-subtle">
        Échanges
      </p>
      <MessageThread
        initial={comments}
        me={me}
        postUrl={`/api/bookings/${bookingId}/report/comments`}
        emptyLabel="Une question sur ce cours ? Écrivez ici."
      />
    </div>
  );
}
