/**
 * Bornes de la photo de profil, sans dépendance serveur.
 *
 * Séparées de `photo.ts` (qui importe `sharp`, purement serveur) pour que le
 * composant d'upload client puisse valider avant l'envoi avec les mêmes
 * valeurs — une seule source, pas de dérive entre client et serveur.
 */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 Mo
export const ACCEPTED_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const AVATAR_SIZE = 512;
