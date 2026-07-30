/**
 * Conventions de nommage des objets stockés.
 *
 * Pures et sans dépendance (ni Prisma ni SDK) : testables en isolation, et
 * c'est le seul endroit qui décide où vit un fichier. Un changement de schéma
 * de nommage se fait ici, pas dispersé dans les routes.
 */

/**
 * Clé de l'avatar d'un utilisateur.
 *
 * **Stable** (une par utilisateur) : un nouvel upload écrase l'ancien, donc
 * aucun orphelin à nettoyer. Le rafraîchissement du cache est géré à l'écriture
 * de l'URL (paramètre `?v=`), pas par la clé.
 */
export function avatarKey(userId: string): string {
  return `avatars/${userId}.webp`;
}

/**
 * Clé d'une pièce jointe de compte rendu, dans le bucket privé.
 *
 * Groupée par cours (`reports/{bookingId}/`) et nommée par l'id (cuid) de la
 * pièce jointe : unique, donc aucune collision, et le préfixe par cours facilite
 * une purge éventuelle. L'extension vient du type de fichier, pour un
 * téléchargement lisible.
 */
export function reportAttachmentKey(
  bookingId: string,
  attachmentId: string,
  ext: string
): string {
  return `reports/${bookingId}/${attachmentId}.${ext}`;
}
