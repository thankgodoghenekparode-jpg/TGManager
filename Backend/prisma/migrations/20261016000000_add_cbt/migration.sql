-- CreateEnum
CREATE TYPE "CbtCategory" AS ENUM ('JAMB', 'WAEC', 'NECO', 'SCHOOL', 'MOCK', 'GENERAL');

-- CreateEnum
CREATE TYPE "CbtExamMode" AS ENUM ('PRACTICE', 'MOCK');

-- CreateEnum
CREATE TYPE "CbtExamStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CbtQuestionSource" AS ENUM ('SCHOOL', 'TGMANAGER', 'LICENSED', 'AI');

-- CreateEnum
CREATE TYPE "CbtDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "CbtQuestionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CbtAttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'EXPIRED');

-- CreateTable
CREATE TABLE "CbtTopic" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "subjectId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CbtTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CbtQuestion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "topicId" TEXT,
    "topicName" TEXT,
    "category" "CbtCategory" NOT NULL DEFAULT 'GENERAL',
    "difficulty" "CbtDifficulty" NOT NULL DEFAULT 'MEDIUM',
    "text" TEXT NOT NULL,
    "imageUrl" TEXT,
    "explanation" TEXT,
    "marks" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "source" "CbtQuestionSource" NOT NULL DEFAULT 'SCHOOL',
    "status" "CbtQuestionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CbtQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CbtQuestionOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CbtQuestionOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CbtExam" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "CbtCategory" NOT NULL DEFAULT 'SCHOOL',
    "mode" "CbtExamMode" NOT NULL DEFAULT 'MOCK',
    "subjectId" TEXT,
    "classId" TEXT,
    "description" TEXT,
    "instructions" TEXT,
    "durationMinutes" INTEGER NOT NULL DEFAULT 30,
    "totalMarks" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "passMark" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "randomizeQuestions" BOOLEAN NOT NULL DEFAULT true,
    "randomizeOptions" BOOLEAN NOT NULL DEFAULT false,
    "maxAttempts" INTEGER NOT NULL DEFAULT 1,
    "showResultImmediately" BOOLEAN NOT NULL DEFAULT true,
    "showCorrectAnswers" BOOLEAN NOT NULL DEFAULT false,
    "negativeMarking" BOOLEAN NOT NULL DEFAULT false,
    "negativeMarkPerWrong" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "status" "CbtExamStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CbtExam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CbtExamQuestion" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "marks" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CbtExamQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CbtExamAssignment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "classId" TEXT,
    "studentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CbtExamAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CbtExamAttempt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "status" "CbtAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalMarks" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "incorrectCount" INTEGER NOT NULL DEFAULT 0,
    "unansweredCount" INTEGER NOT NULL DEFAULT 0,
    "percentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "timeUsedSeconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CbtExamAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CbtExamAttemptAnswer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedOptionId" TEXT,
    "isCorrect" BOOLEAN,
    "marksAwarded" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "markedForReview" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CbtExamAttemptAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CbtTopic_tenantId_idx" ON "CbtTopic"("tenantId");

-- CreateIndex
CREATE INDEX "CbtTopic_subjectId_idx" ON "CbtTopic"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "CbtTopic_tenantId_name_key" ON "CbtTopic"("tenantId", "name");

-- CreateIndex
CREATE INDEX "CbtQuestion_tenantId_idx" ON "CbtQuestion"("tenantId");

-- CreateIndex
CREATE INDEX "CbtQuestion_tenantId_subjectId_idx" ON "CbtQuestion"("tenantId", "subjectId");

-- CreateIndex
CREATE INDEX "CbtQuestion_tenantId_category_idx" ON "CbtQuestion"("tenantId", "category");

-- CreateIndex
CREATE INDEX "CbtQuestion_tenantId_status_idx" ON "CbtQuestion"("tenantId", "status");

-- CreateIndex
CREATE INDEX "CbtQuestion_topicId_idx" ON "CbtQuestion"("topicId");

-- CreateIndex
CREATE INDEX "CbtQuestionOption_questionId_idx" ON "CbtQuestionOption"("questionId");

-- CreateIndex
CREATE INDEX "CbtExam_tenantId_idx" ON "CbtExam"("tenantId");

-- CreateIndex
CREATE INDEX "CbtExam_tenantId_status_idx" ON "CbtExam"("tenantId", "status");

-- CreateIndex
CREATE INDEX "CbtExam_tenantId_category_idx" ON "CbtExam"("tenantId", "category");

-- CreateIndex
CREATE INDEX "CbtExam_classId_idx" ON "CbtExam"("classId");

-- CreateIndex
CREATE INDEX "CbtExam_subjectId_idx" ON "CbtExam"("subjectId");

-- CreateIndex
CREATE INDEX "CbtExamQuestion_examId_idx" ON "CbtExamQuestion"("examId");

-- CreateIndex
CREATE INDEX "CbtExamQuestion_questionId_idx" ON "CbtExamQuestion"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "CbtExamQuestion_examId_questionId_key" ON "CbtExamQuestion"("examId", "questionId");

-- CreateIndex
CREATE INDEX "CbtExamAssignment_tenantId_idx" ON "CbtExamAssignment"("tenantId");

-- CreateIndex
CREATE INDEX "CbtExamAssignment_examId_idx" ON "CbtExamAssignment"("examId");

-- CreateIndex
CREATE INDEX "CbtExamAssignment_classId_idx" ON "CbtExamAssignment"("classId");

-- CreateIndex
CREATE INDEX "CbtExamAssignment_studentId_idx" ON "CbtExamAssignment"("studentId");

-- CreateIndex
CREATE INDEX "CbtExamAttempt_tenantId_idx" ON "CbtExamAttempt"("tenantId");

-- CreateIndex
CREATE INDEX "CbtExamAttempt_examId_studentId_idx" ON "CbtExamAttempt"("examId", "studentId");

-- CreateIndex
CREATE INDEX "CbtExamAttempt_studentId_idx" ON "CbtExamAttempt"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "CbtExamAttempt_examId_studentId_attemptNumber_key" ON "CbtExamAttempt"("examId", "studentId", "attemptNumber");

-- CreateIndex
CREATE INDEX "CbtExamAttemptAnswer_attemptId_idx" ON "CbtExamAttemptAnswer"("attemptId");

-- CreateIndex
CREATE INDEX "CbtExamAttemptAnswer_questionId_idx" ON "CbtExamAttemptAnswer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "CbtExamAttemptAnswer_attemptId_questionId_key" ON "CbtExamAttemptAnswer"("attemptId", "questionId");

-- AddForeignKey
ALTER TABLE "CbtTopic" ADD CONSTRAINT "CbtTopic_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CbtTopic" ADD CONSTRAINT "CbtTopic_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CbtQuestion" ADD CONSTRAINT "CbtQuestion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CbtQuestion" ADD CONSTRAINT "CbtQuestion_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CbtQuestion" ADD CONSTRAINT "CbtQuestion_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "CbtTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CbtQuestion" ADD CONSTRAINT "CbtQuestion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CbtQuestionOption" ADD CONSTRAINT "CbtQuestionOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "CbtQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CbtExam" ADD CONSTRAINT "CbtExam_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CbtExam" ADD CONSTRAINT "CbtExam_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CbtExam" ADD CONSTRAINT "CbtExam_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CbtExam" ADD CONSTRAINT "CbtExam_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CbtExamQuestion" ADD CONSTRAINT "CbtExamQuestion_examId_fkey" FOREIGN KEY ("examId") REFERENCES "CbtExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CbtExamQuestion" ADD CONSTRAINT "CbtExamQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "CbtQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CbtExamAssignment" ADD CONSTRAINT "CbtExamAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CbtExamAssignment" ADD CONSTRAINT "CbtExamAssignment_examId_fkey" FOREIGN KEY ("examId") REFERENCES "CbtExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CbtExamAssignment" ADD CONSTRAINT "CbtExamAssignment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CbtExamAssignment" ADD CONSTRAINT "CbtExamAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CbtExamAttempt" ADD CONSTRAINT "CbtExamAttempt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CbtExamAttempt" ADD CONSTRAINT "CbtExamAttempt_examId_fkey" FOREIGN KEY ("examId") REFERENCES "CbtExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CbtExamAttempt" ADD CONSTRAINT "CbtExamAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CbtExamAttemptAnswer" ADD CONSTRAINT "CbtExamAttemptAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "CbtExamAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CbtExamAttemptAnswer" ADD CONSTRAINT "CbtExamAttemptAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "CbtQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CbtExamAttemptAnswer" ADD CONSTRAINT "CbtExamAttemptAnswer_selectedOptionId_fkey" FOREIGN KEY ("selectedOptionId") REFERENCES "CbtQuestionOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

