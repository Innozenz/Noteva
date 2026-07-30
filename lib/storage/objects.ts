import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

import { s3 } from "./client";
import { storageConfig } from "./config";

/**
 * Opérations sur les objets du bucket public.
 *
 * L'accès public passe par l'ACL `public-read` posée sur chaque objet — pas par
 * une politique de bucket. Vérifié contre Scaleway : un objet ainsi téléversé
 * répond 200 à un GET anonyme, la liste du bucket restant privée.
 */

/** URL publique stable d'une clé du bucket public. */
export function publicUrl(key: string): string {
  return `${storageConfig.publicBaseUrl}/${key}`;
}

/** Téléverse un objet en lecture publique et rend son URL publique. */
export async function uploadPublic(params: {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
}): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: storageConfig.bucketPublic,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
      ACL: "public-read",
      // Clé stable + URL versionnée à l'écriture (`?v=`) : on peut donc mettre
      // en cache agressivement, une nouvelle photo produit une nouvelle URL.
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  return publicUrl(params.key);
}

/** Supprime un objet du bucket public. */
export async function deletePublic(key: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: storageConfig.bucketPublic,
      Key: key,
    })
  );
}
