"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, FileText, MessageSquare, Paperclip } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Un compte rendu pliable dans la liste d'une fiche / d'un dossier.
 *
 * L'en-tête (titre, date, état, compteurs) reste toujours visible et sert de
 * bouton ; le corps se déploie au clic. Fermé par défaut pour garder la liste
 * compacte, sauf le plus récent (`defaultOpen`) et celui visé par l'ancre
 * `#cr-…` — le lien « Compte rendu » de l'historique ouvre alors directement le
 * bon. Le corps (`ReportViewer`) est rendu côté serveur et passé en `children`.
 */
export function CollapsibleReport({
  title,
  dateLabel,
  statusLabel,
  statusVariant,
  hashId,
  attachmentCount,
  commentCount,
  defaultOpen = false,
  children,
}: {
  title: string;
  dateLabel: string;
  statusLabel: string;
  statusVariant: "success" | "secondary";
  hashId: string;
  attachmentCount: number;
  commentCount: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Synchronisation avec l'URL : l'ancre n'est connue que côté client, donc
    // après hydratation. Serveur et client rendent d'abord `defaultOpen` à
    // l'identique (pas de divergence) ; on ouvre ensuite le compte rendu visé.
    if (window.location.hash === `#${hashId}`) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(true);
      ref.current?.scrollIntoView({ block: "start" });
    }
  }, [hashId]);

  return (
    <div ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 bg-surface px-4 py-3 text-left"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary">
          <FileText className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium leading-tight">{title}</p>
          <p className="text-xs text-muted">{dateLabel}</p>
        </div>

        {!open && (attachmentCount > 0 || commentCount > 0) ? (
          <span className="hidden shrink-0 items-center gap-2 text-xs text-subtle sm:flex">
            {attachmentCount > 0 ? (
              <span className="flex items-center gap-1">
                <Paperclip className="h-3.5 w-3.5" />
                {attachmentCount}
              </span>
            ) : null}
            {commentCount > 0 ? (
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5" />
                {commentCount}
              </span>
            ) : null}
          </span>
        ) : null}

        <Badge variant={statusVariant}>{statusLabel}</Badge>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {/* Pliage animé : la ligne de grille passe de 0fr à 1fr, ce qui anime la
          hauteur jusqu'à `auto` sans mesure JS. Le corps reste monté (l'état des
          brouillons de messages survit), mais `inert` le sort de la tabulation
          et des lecteurs d'écran tant qu'il est replié. */}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden" inert={!open}>
          <div className="border-t border-border p-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
