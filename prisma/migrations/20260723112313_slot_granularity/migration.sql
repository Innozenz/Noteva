-- NOTE : `prisma migrate diff` avait généré ici un
--   DROP INDEX "instrument_aliases_idx";
-- Retiré à la main, pour la deuxième fois. Cet index GIN est écrit dans la
-- queue manuscrite de la migration initiale ; Prisma ne le connaît pas et veut
-- donc le supprimer à chaque nouvelle migration. Le laisser passer casserait la
-- recherche par alias (« technique vocale » → chant) sans autre symptôme qu'une
-- lenteur croissante.

-- AlterTable
ALTER TABLE "teacher_profile" ADD COLUMN     "slotGranularityMin" INTEGER NOT NULL DEFAULT 30;
