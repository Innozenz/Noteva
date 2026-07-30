-- Âge du prof : date de naissance (date civile, @db.Date) + choix explicite de
-- l'afficher sur la fiche publique. Rien n'est exposé par défaut (showAge =
-- false) — minimisation RGPD. Écrite à la main : le générateur aurait ajouté
-- par-dessus un `DROP INDEX "instrument_aliases_idx"` (index posé à la main dans
-- la migration initiale, que Prisma cherche à défaire à chaque fois) ; ne pas le
-- réintroduire, il casserait la recherche par alias sans symptôme.
ALTER TABLE "teacher_profile" ADD COLUMN "birthDate" DATE,
ADD COLUMN "showAge" BOOLEAN NOT NULL DEFAULT false;
