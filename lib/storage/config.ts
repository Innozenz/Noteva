/**
 * Configuration du stockage objet (Scaleway Object Storage, compatible S3).
 *
 * Fail-fast à l'évaluation, comme `lib/stripe.ts` : mieux vaut une erreur qui
 * nomme la variable manquante qu'un échec S3 obscur au premier upload.
 *
 * Seules les variables du bucket **public** sont exigées ici : c'est tout ce
 * dont la photo de profil a besoin. Le bucket privé (pièces jointes, audio)
 * viendra avec ses propres besoins, sans bloquer cette fonctionnalité.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} manquante : impossible d'initialiser le stockage objet.`
    );
  }
  return value;
}

export const storageConfig = {
  region: required("SCALEWAY_REGION"),
  endpoint: required("SCALEWAY_ENDPOINT"),
  accessKeyId: required("SCALEWAY_ACCESS_KEY"),
  secretAccessKey: required("SCALEWAY_SECRET_KEY"),
  bucketPublic: required("SCALEWAY_BUCKET_PUBLIC"),
  // Sans slash final : les clés sont concaténées avec un « / ».
  publicBaseUrl: required("SCALEWAY_PUBLIC_BASE_URL").replace(/\/+$/, ""),
} as const;
