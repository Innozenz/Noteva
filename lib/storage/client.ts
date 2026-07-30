import { S3Client } from "@aws-sdk/client-s3";

import { storageConfig } from "./config";

/**
 * Client S3 pointé sur Scaleway Object Storage.
 *
 * `forcePathStyle: true` : URL `endpoint/bucket/clé` plutôt que
 * `bucket.endpoint/clé`. Accepté par Scaleway et évite les soucis de
 * résolution du sous-domaine par bucket.
 */
export const s3 = new S3Client({
  region: storageConfig.region,
  endpoint: storageConfig.endpoint,
  credentials: {
    accessKeyId: storageConfig.accessKeyId,
    secretAccessKey: storageConfig.secretAccessKey,
  },
  forcePathStyle: true,
});
