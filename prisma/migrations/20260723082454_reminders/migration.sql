-- CreateEnum
CREATE TYPE "ReminderKind" AS ENUM ('H24');

-- NOTE : `prisma migrate diff` avait généré ici un
--   DROP INDEX "instrument_aliases_idx";
-- Il a été retiré à la main. Cet index GIN est écrit dans la queue manuscrite
-- de la migration initiale ; Prisma ne le connaît pas et veut donc le
-- supprimer à chaque nouvelle migration. Le laisser passer casserait la
-- recherche par alias (« technique vocale » → chant) sans autre symptôme
-- qu'une lenteur croissante. Vérifier ce point à chaque migration.

-- CreateTable
CREATE TABLE "booking_reminder" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "kind" "ReminderKind" NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_reminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "booking_reminder_bookingId_kind_key" ON "booking_reminder"("bookingId", "kind");

-- AddForeignKey
ALTER TABLE "booking_reminder" ADD CONSTRAINT "booking_reminder_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
