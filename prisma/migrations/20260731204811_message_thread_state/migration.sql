-- CreateTable
CREATE TABLE "message_thread_state" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherReadAt" TIMESTAMP(3),
    "studentReadAt" TIMESTAMP(3),

    CONSTRAINT "message_thread_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "message_thread_state_teacherId_studentId_key" ON "message_thread_state"("teacherId", "studentId");

-- AddForeignKey
ALTER TABLE "message_thread_state" ADD CONSTRAINT "message_thread_state_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teacher_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_thread_state" ADD CONSTRAINT "message_thread_state_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
