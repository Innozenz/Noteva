-- CreateEnum
CREATE TYPE "MessageSender" AS ENUM ('TEACHER', 'STUDENT');


-- CreateTable
CREATE TABLE "message" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sender" "MessageSender" NOT NULL,
    "content" TEXT NOT NULL,
    "reportId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "message_teacherId_studentId_createdAt_idx" ON "message"("teacherId", "studentId", "createdAt");

-- CreateIndex
CREATE INDEX "message_reportId_idx" ON "message"("reportId");

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teacher_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "lesson_report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
