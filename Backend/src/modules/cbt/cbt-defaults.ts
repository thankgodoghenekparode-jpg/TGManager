import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '../../generated/prisma/client';
import { CBT_SEED_PLAN, defaultDurationMinutes } from './cbt-defaults.data';

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/** PrismaService extends PrismaClient, so both satisfy this. */
export type CbtSeedDb = PrismaClient;

export interface SeedDefaultsResult {
  questions: number;
  exams: number;
  topics: number;
  /** Categories that already had content and were left untouched. */
  skipped: string[];
}

/**
 * Populates a school's CBT bank with TGManager's default practice content —
 * one examination per category (WAEC, NECO, JAMB, Mock Examination).
 *
 * Idempotent per category: a category that already has questions is left
 * untouched, so this is safe to call on provisioning *and* to backfill an
 * existing school. Use {@link resetCbtForTenant} first to replace content.
 */
export async function seedCbtDefaults(
  prisma: CbtSeedDb,
  tenantId: string,
  options: { createdByUserId?: string | null } = {},
): Promise<SeedDefaultsResult> {
  const logger = new Logger('CbtDefaults');
  const summary: SeedDefaultsResult = { questions: 0, exams: 0, topics: 0, skipped: [] };

  const subjects = await prisma.subject.findMany({
    where: { tenantId },
    select: { id: true, name: true },
  });
  if (subjects.length === 0) {
    logger.warn(`CBT defaults skipped for tenant ${tenantId}: no subjects configured.`);
    return summary;
  }

  const subjectByName = new Map(subjects.map((subject) => [subject.name, subject.id]));
  const fallbackSubjectId = subjects[0].id;
  const resolveSubject = (name: string) => subjectByName.get(name) ?? fallbackSubjectId;
  const createdByUserId = options.createdByUserId ?? null;

  for (const plan of CBT_SEED_PLAN) {
    const existing = await prisma.cbtQuestion.count({
      where: { tenantId, category: plan.category },
    });
    if (existing > 0) {
      summary.skipped.push(plan.category);
      continue;
    }

    // 1. Topics (shared per tenant, unique by name).
    const topicNames = [...new Set(plan.questions.map((item) => item.topic))];
    await prisma.cbtTopic.createMany({
      data: topicNames.map((name) => ({ id: randomUUID(), tenantId, name })),
      skipDuplicates: true,
    });
    const topics = await prisma.cbtTopic.findMany({
      where: { tenantId, name: { in: topicNames } },
      select: { id: true, name: true },
    });
    const topicByName = new Map(topics.map((topic) => [topic.name, topic.id]));
    summary.topics += topicNames.length;

    // 2. Questions (batched) + options (batched).
    const questionRows = plan.questions.map((item) => ({
      id: randomUUID(),
      tenantId,
      subjectId: resolveSubject(item.subject),
      topicId: topicByName.get(item.topic) ?? null,
      topicName: item.topic,
      category: plan.category,
      difficulty: item.difficulty,
      text: item.text,
      explanation: item.explanation,
      marks: 1,
      source: 'TGMANAGER' as const,
      status: 'ACTIVE' as const,
      createdByUserId,
    }));
    await prisma.cbtQuestion.createMany({ data: questionRows });

    const optionRows = plan.questions.flatMap((item, index) =>
      item.options.map((text, optionIndex) => ({
        id: randomUUID(),
        questionId: questionRows[index].id,
        label: OPTION_LABELS[optionIndex] ?? String(optionIndex + 1),
        text,
        isCorrect: optionIndex === item.correct,
        order: optionIndex,
      })),
    );
    await prisma.cbtQuestionOption.createMany({ data: optionRows });

    // 3. The default examination for this category (open to the whole school;
    //    schools can assign, target or edit it afterwards).
    const alreadyHasExam = await prisma.cbtExam.count({
      where: { tenantId, title: plan.title },
    });
    if (alreadyHasExam === 0) {
      const exam = await prisma.cbtExam.create({
        data: {
          tenantId,
          title: plan.title,
          category: plan.category,
          mode: plan.mode,
          description: plan.description,
          instructions: plan.instructions,
          durationMinutes: defaultDurationMinutes(plan.questions.length),
          totalMarks: plan.questions.length,
          passMark: plan.passMark,
          randomizeQuestions: true,
          randomizeOptions: true,
          maxAttempts: plan.maxAttempts,
          showResultImmediately: true,
          showCorrectAnswers: plan.showCorrectAnswers,
          status: 'PUBLISHED',
          createdByUserId,
        },
        select: { id: true },
      });
      await prisma.cbtExamQuestion.createMany({
        data: questionRows.map((question, index) => ({
          id: randomUUID(),
          examId: exam.id,
          questionId: question.id,
          order: index,
          marks: 1,
        })),
      });
      summary.exams += 1;
    }

    summary.questions += questionRows.length;
  }

  return summary;
}

/**
 * Removes every CBT record owned by a tenant (attempts, exams, questions and
 * topics). Destructive — only used by the seed CLI's `--reset` path.
 */
export async function resetCbtForTenant(
  prisma: CbtSeedDb,
  tenantId: string,
): Promise<void> {
  await prisma.cbtExamAttempt.deleteMany({ where: { tenantId } });
  await prisma.cbtExam.deleteMany({ where: { tenantId } });
  await prisma.cbtQuestion.deleteMany({ where: { tenantId } });
  await prisma.cbtTopic.deleteMany({ where: { tenantId } });
}
