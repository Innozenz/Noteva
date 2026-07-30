import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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

// --- Bucket privé (pièces jointes des comptes rendus) -----------------------
// Jamais d'ACL publique : les objets restent privés, servis par URL signée à
// expiration après vérification que le demandeur est participant au cours.

/** Téléverse un objet privé (aucun accès public). */
export async function uploadPrivate(params: {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
}): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: storageConfig.bucketPrivate,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
    })
  );
}

/** Supprime un objet du bucket privé. */
export async function deletePrivate(key: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: storageConfig.bucketPrivate,
      Key: key,
    })
  );
}

/**
 * URL signée de lecture d'un objet privé, à expiration courte.
 *
 * `inline` : l'image s'affiche, le PDF s'ouvre, l'audio se lit dans le
 * navigateur. Le nom d'origine est nettoyé des caractères qui casseraient
 * l'en-tête (injection). Défaut 5 min : assez pour ouvrir, trop court pour
 * partager durablement.
 */
export async function presignView(params: {
  key: string;
  filename: string;
  expiresIn?: number;
}): Promise<string> {
  const safe = params.filename.replace(/["\\\r\n]/g, "");
  const command = new GetObjectCommand({
    Bucket: storageConfig.bucketPrivate,
    Key: params.key,
    ResponseContentDisposition: `inline; filename="${safe}"`,
  });
  return getSignedUrl(s3, command, { expiresIn: params.expiresIn ?? 300 });
}
