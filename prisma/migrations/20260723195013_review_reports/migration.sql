-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('OFFENSIVE', 'DISHONEST', 'PRIVACY', 'SPAM', 'OTHER');

-- NOTE: le `DROP INDEX "instrument_aliases_idx"` que Prisma régénère ici a été
-- retiré à la main. Cet index GIN est écrit en SQL manuel dans la migration
-- initiale ; Prisma l'ignore et tente de le supprimer à chaque migration, ce
-- qui casserait la recherche par alias (« technique vocale » → chant).

-- CreateTable
CREATE TABLE "review_report" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "detail" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "review_report_reviewId_key" ON "review_report"("reviewId");

-- CreateIndex
CREATE INDEX "review_report_resolvedAt_idx" ON "review_report"("resolvedAt");

-- AddForeignKey
ALTER TABLE "review_report" ADD CONSTRAINT "review_report_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_report" ADD CONSTRAINT "review_report_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teacher_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
