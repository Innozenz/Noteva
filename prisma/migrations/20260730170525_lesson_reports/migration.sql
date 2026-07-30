-- CreateEnum
CREATE TYPE "AttachmentKind" AS ENUM ('IMAGE', 'SCORE', 'AUDIO');

-- Note : le générateur avait ajouté ici un `DROP INDEX "instrument_aliases_idx"`.
-- Cet index est écrit à la main dans la migration initiale, Prisma ne le connaît
-- donc pas et cherche à le défaire à chaque migration. Le supprimer casserait la
-- recherche par alias (« technique vocale » → chant). Retiré à la main.

-- CreateTable
CREATE TABLE "lesson_report" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "content" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_attachment" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "kind" "AttachmentKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lesson_report_bookingId_key" ON "lesson_report"("bookingId");

-- CreateIndex
CREATE INDEX "report_attachment_reportId_idx" ON "report_attachment"("reportId");

-- AddForeignKey
ALTER TABLE "lesson_report" ADD CONSTRAINT "lesson_report_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_attachment" ADD CONSTRAINT "report_attachment_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "lesson_report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
