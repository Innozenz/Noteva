# 🗃️ SiNote — Plan de stockage de fichiers (Scaleway)

**Fondation qui débloque trois fonctionnalités** : photo de profil, pièces jointes (images / partitions), notes audio. On la pose **avec la photo de profil prof comme pilote** — le cas le plus simple — pour éprouver l'infra de bout en bout avant d'y accrocher le reste.

> **Cohérence RGPD** : hébergement **français** (région `fr-par`), entreprise française, pas de CLOUD Act américain. Cible de prod = **VPS français** ; Scaleway s'y branche sans changement.

---

## 🪣 Deux buckets, deux régimes de confidentialité

| Bucket | Contenu | Accès aux objets |
| --- | --- | --- |
| `sinote-public` | photos de profil prof | **public-read par objet** (ACL posée à l'upload) → URL directe, pérenne, cacheable |
| `sinote-private` | partitions, audio, pièces jointes de comptes rendus | privé → **URL signées** à expiration, générées côté serveur |

> ⚠️ **Le réglage « Bucket visibility » de Scaleway ne concerne que la *liste* des objets, pas les objets eux-mêmes.** Un fichier est privé par défaut même dans un bucket « public ». On crée donc **les deux buckets en `Private`** (ne jamais rendre la liste des fichiers énumérable — ça exposerait tous les `userId`). Les photos deviennent lisibles via l'**ACL `public-read` posée sur chaque objet** à l'upload (paramètre du SDK S3), ou à défaut une **bucket policy** de `GetObject` public sur `sinote-public`. À confirmer contre le vrai Scaleway au moment du test.

### Pourquoi deux et pas un ?

Un seul bucket avec ACL par objet marcherait, mais deux buckets donnent le **default-deny** gratuitement :

- **Blast-radius d'une erreur** — la confidentialité est une propriété de *l'endroit* où le fichier atterrit, pas d'un drapeau à poser correctement à chaque upload. Le code qui écrit une partition ne connaît que le bucket privé : impossible de fuiter une donnée privée dans l'espace public par cette classe d'erreur.
- **Deux régimes opposés** — photo publique = URL stable cacheable, sans signature ; partition/audio = URL signée non cacheable. Cache, CORS, cycle de vie différents.
- **Ça tombe sur l'archi SEO** — une URL signée expire, donc inutilisable en balise OG / page indexée / cache. La photo de prof vit sur une fiche publique indexée : elle veut une URL publique stable.

Créer un bucket est gratuit ; on ne paie que le stockage réellement utilisé.

---

## 🔀 Deux patterns d'upload

**Photos → à travers le serveur, retraitées.** Le navigateur envoie l'original à une route Next, qui avec **`sharp`** redimensionne (~512 px), ré-encode en **WebP** et **supprime les métadonnées EXIF** (le GPS d'une photo est une fuite RGPD réelle), puis pousse vers `sinote-public`. Fichiers petits, coût serveur négligeable.

**Audio / pièces jointes (plus tard) → upload direct signé (presigned PUT).** Le serveur émet une URL signée (auth + type + taille bornés), le navigateur PUT directement sur Scaleway, puis notifie le serveur de la clé finale. Garde les gros fichiers **hors** du serveur Next — décisif sur un VPS à bande passante limitée.

On code le pilote (photo) selon le premier pattern ; le second se pose au moment de l'audio.

---

> 💡 **Le stockage n'est pas couplé à l'hébergement de l'app.** Scaleway Object Storage est une API S3 en HTTPS : ces clés fonctionnent **depuis Vercel** (test actuel) comme depuis le futur **VPS**. Rien à attendre du côté hébergement pour s'en servir.

## 🔑 Variables d'environnement

```
SCALEWAY_ACCESS_KEY=""
SCALEWAY_SECRET_KEY=""
SCALEWAY_REGION="fr-par"
SCALEWAY_ENDPOINT="https://s3.fr-par.scw.cloud"
SCALEWAY_BUCKET_PUBLIC="sinote-public"
SCALEWAY_BUCKET_PRIVATE="sinote-private"
SCALEWAY_PUBLIC_BASE_URL="https://s3.fr-par.scw.cloud/sinote-public"
```

> `forcePathStyle: true` dans le client S3 (URL `endpoint/bucket/clé`) — accepté par Scaleway, et évite les soucis de sous-domaine par bucket.

## 📦 Dépendances

- `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (Scaleway est S3-compatible)
- `sharp` (retraitement image) — ⚠️ sur le build Docker `standalone` / VPS, veiller au binaire de la bonne plateforme.

---

## 🧱 Module `lib/storage/` (nouveau)

| Fichier | Rôle |
| --- | --- |
| `client.ts` | `S3Client` configuré Scaleway, credentials depuis l'env, **fail-fast si manquants** (comme `lib/stripe.ts`) |
| `keys.ts` | Conventions de nommage **pures et testables** : `avatars/{userId}.webp` (clé stable → écrase l'ancienne, zéro orphelin) ; plus tard `reports/{bookingId}/{uuid}` |
| `objects.ts` | `uploadPublic()`, `deleteObject()`, et plus tard `presignPut()` / `presignGet()` |

---

## 🖼️ Le pilote : photo de profil (profs uniquement)

- **Stockage** : on réutilise `User.image` (déjà lu à 6 endroits — fiche publique, recherche, `UserNav`, OG image — mais jamais renseigné). Rien à ajouter au schéma.
- **Routes** :
  - `POST /api/user/photo` (multipart) → auth → valide type MIME **réel** + taille (< 5 Mo) → `sharp` (512 px → WebP → EXIF supprimé) → `uploadPublic` → `User.image = url` → `router.refresh()`.
  - `DELETE /api/user/photo` → supprime l'objet + `User.image = null`.
- **UI** : uploader d'avatar sur l'écran **« Ma fiche »** du prof (feature prof pour l'instant). La photo appartient à la personne (`User.image`), donc quand les élèves l'auront, l'uploader remontera sur `/dashboard/compte` (identité partagée) sans changer la route.
- **Rendu** : fiche publique + `UserNav`, avec cache-bust `?v={updatedAt}` (sinon l'ancienne photo reste en cache).

### Décisions produit verrouillées

- **Photos profs seulement** pour l'instant. Élèves reportés ; **photo d'un mineur** = donnée sensible (consentement du responsable, bucket privé) → traitée plus tard.
- **Upload photo via serveur** maintenant ; **presigned direct** pour l'audio plus tard.

---

## 🛡️ Points RGPD / sécurité dans l'implémentation

- **EXIF/GPS supprimé** au ré-encodage `sharp` (par défaut).
- **Validation stricte** du type MIME réel (pas l'extension) et de la taille, côté serveur.
- **`Permissions-Policy`** dans `next.config.ts` bloque le micro (`microphone=()`) — à relâcher en `microphone=(self)` **le jour de l'audio**, pas avant.
- **Suppression de compte** → purge des objets associés (à câbler quand la suppression de compte existera).

## 🧪 Tests

- Unitaires purs : nommage des clés + validation type/taille.
- Vérif **réelle contre Scaleway** une fois les clés en place (comme Stripe en test mode) : upload → objet présent → URL publique lisible → suppression.

---

## ⛳ Ce qui débloque le code

Côté **console Scaleway** :

1. Un projet **Object Storage**, région **`fr-par`** (Paris)
2. Deux buckets **tous deux en visibility `Private`** : **`sinote-public`** (photos, rendues publiques par ACL objet à l'upload) et **`sinote-private`** (privé strict). Chiffrement **SSE-ONE**, versioning désactivé.
3. Une **clé API** (Access key + Secret key) via IAM

Puis renseigner les variables `SCALEWAY_*` dans `.env` (local) **et** dans les variables d'environnement Vercel (déploiement de test).
