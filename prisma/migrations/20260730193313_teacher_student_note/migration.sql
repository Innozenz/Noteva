
-- CreateTable
CREATE TABLE "teacher_student_note" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "content" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_student_note_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teacher_student_note_teacherId_studentId_key" ON "teacher_student_note"("teacherId", "studentId");

-- AddForeignKey
ALTER TABLE "teacher_student_note" ADD CONSTRAINT "teacher_student_note_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teacher_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_student_note" ADD CONSTRAINT "teacher_student_note_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
