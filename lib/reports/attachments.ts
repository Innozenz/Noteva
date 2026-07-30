import type { AttachmentKind } from "@prisma/client";

/**
 * Types de pièces jointes acceptés dans un compte rendu, purs et testables.
 *
 * Le type MIME réel décide du `kind` (pour l'affichage groupé et l'icône), de
 * l'extension du fichier stocké (pour un téléchargement lisible) et de la taille
 * maximale. `MediaRecorder` produit « audio/webm;codecs=opus » : on ne compare
 * que la partie avant le « ; ».
 */

const MB = 1024 * 1024;

export type AttachmentType = {
  kind: AttachmentKind;
  ext: string;
  maxBytes: number;
};

const TYPES: Record<string, AttachmentType> = {
  "image/jpeg": { kind: "IMAGE", ext: "jpg", maxBytes: 10 * MB },
  "image/png": { kind: "IMAGE", ext: "png", maxBytes: 10 * MB },
  "image/webp": { kind: "IMAGE", ext: "webp", maxBytes: 10 * MB },
  "application/pdf": { kind: "SCORE", ext: "pdf", maxBytes: 20 * MB },
  "audio/webm": { kind: "AUDIO", ext: "webm", maxBytes: 20 * MB },
  "audio/ogg": { kind: "AUDIO", ext: "ogg", maxBytes: 20 * MB },
  "audio/mpeg": { kind: "AUDIO", ext: "mp3", maxBytes: 20 * MB },
  "audio/mp4": { kind: "AUDIO", ext: "m4a", maxBytes: 20 * MB },
  "audio/wav": { kind: "AUDIO", ext: "wav", maxBytes: 20 * MB },
};

/** Résout un type MIME (codecs ignorés) en type de pièce jointe, ou null. */
export function resolveAttachmentType(contentType: string): AttachmentType | null {
  const base = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return TYPES[base] ?? null;
}

/** Types acceptés au choix d'un fichier (images + partitions ; l'audio est enregistré). */
export const FILE_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

/** Nombre maximum de pièces jointes par compte rendu. */
export const MAX_ATTACHMENTS = 12;
