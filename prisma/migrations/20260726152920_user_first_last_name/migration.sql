-- Prénom et nom saisis séparément. Nuls pour les comptes existants : Better
-- Auth ne renseigne que `name`, et `lib/user/name.ts` retombe sur son découpage
-- tant que rien n'a été saisi. Aucune reprise de données n'est donc nécessaire.
ALTER TABLE "user" ADD COLUMN "firstName" TEXT,
ADD COLUMN "lastName" TEXT;

-- Note : le générateur avait ajouté ici un `DROP INDEX "instrument_aliases_idx"`.
-- Cet index est écrit à la main dans la migration initiale, Prisma ne le connaît
-- donc pas et cherche à le défaire à chaque migration. Le supprimer casserait la
-- recherche par alias (« technique vocale » → chant) sans aucun symptôme, sinon
-- une lenteur croissante. Ne pas le réintroduire.
