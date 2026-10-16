import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { requireStudentRecord } from './cbt-access';
import { cbtHashSeed, cbtShuffle } from './cbt.constants';
import { CbtExamsService } from './cbt-exams.service';
import {
  computeTimeUsedSeconds,
  remainingSeconds,
  scoreAttempt,
  type ScoringQuestion,
} from './cbt-scoring';
import type { SaveAnswersDto, StartAttemptDto, SubmitAttemptDto } from './dto/cbt.dto';

type AttemptWithExam = Prisma.CbtExamAttemptGetPayload<{
  include: {
    exam: { include: { subject: { select: { id: true; code: true; name: true } } } };
    answers: {
      select: {
        id: true;
        questionId: true;
        selectedOptionId: true;
        markedForReview: true;
        isCorrect: true;
        marksAwarded: true;
        updatedAt: true;
      };
    };
  };
}>;

const attemptInclude = {
  exam: {
    include: { subject: { select: { id: true, code: true, name: true } } },
  },
  answers: {
    select: {
      id: true,
      questionId: true,
      selectedOptionId: true,
      markedForReview: true,
      isCorrect: true,
      marksAwarded: true,
      updatedAt: true,
    },
  },
} as const;

@Injectable()
export class CbtAttemptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exams: CbtExamsService,
  ) {}

  // --------------------------------------------------------------------------
  // Student lifecycle
  // --------------------------------------------------------------------------

  /**
   * Resumes a live attempt or starts a new one. Creates answer rows up front so
   * progress can be restored after a refresh or a dropped connection.
   */
  async start(tenantId: string, userId: string, dto: StartAttemptDto) {
    const student = await this.requireStudent(tenantId, userId);
    const exam = await this.exams.getForStudent(tenantId, student.id, dto.examId);

    const now = new Date();
    if (exam.isClosed) {
      throw new BadRequestException(
        exam.startAt && exam.startAt > now
          ? 'This examination has not started yet'
          : 'This examination window has closed',
      );
    }

    const live = await this.prisma.cbtExamAttempt.findFirst({
      where: { examId: exam.id, studentId: student.id, status: 'IN_PROGRESS' },
      orderBy: { attemptNumber: 'desc' },
      include: attemptInclude,
    });

    if (live) {
      if (live.expiresAt <= now) {
        await this.finalize(live, 'expired');
      } else {
        return { mode: 'attempt' as const, ...(await this.buildAttemptPayload(live)) };
      }
    }

    const used = await this.prisma.cbtExamAttempt.count({
      where: {
        examId: exam.id,
        studentId: student.id,
        status: { in: ['SUBMITTED', 'EXPIRED'] },
      },
    });
    if (used >= exam.maxAttempts) {
      throw new ForbiddenException(
        `You have used all ${exam.maxAttempts} attempt(s) for this examination.`,
      );
    }

    const examQuestions = await this.prisma.cbtExamQuestion.findMany({
      where: { examId: exam.id },
      orderBy: { order: 'asc' },
      select: { questionId: true },
    });
    if (examQuestions.length === 0) {
      throw new BadRequestException('This examination has no questions yet.');
    }

    const lastNumber = await this.prisma.cbtExamAttempt.aggregate({
      where: { examId: exam.id, studentId: student.id },
      _max: { attemptNumber: true },
    });

    const startedAt = new Date();
    const attempt = await this.prisma.cbtExamAttempt.create({
      data: {
        tenantId,
        examId: exam.id,
        studentId: student.id,
        attemptNumber: (lastNumber._max.attemptNumber ?? 0) + 1,
        startedAt,
        expiresAt: new Date(startedAt.getTime() + exam.durationMinutes * 60_000),
        answers: { create: examQuestions.map((row) => ({ questionId: row.questionId })) },
      },
      include: attemptInclude,
    });

    return { mode: 'attempt' as const, ...(await this.buildAttemptPayload(attempt)) };
  }

  /**
   * Resumes an in-progress attempt (or returns the final result after the
   * server clock expired it). This is the single restore point after refresh.
   */
  async getAttempt(tenantId: string, userId: string, attemptId: string) {
    const student = await this.requireStudent(tenantId, userId);
    const attempt = await this.loadAttempt(tenantId, student.id, attemptId);

    if (attempt.status === 'IN_PROGRESS') {
      if (attempt.expiresAt <= new Date()) {
        await this.finalize(attempt, 'expired');
        const fresh = await this.loadAttempt(tenantId, student.id, attemptId);
        return { mode: 'result' as const, ...(await this.buildResultPayload(fresh)) };
      }
      return { mode: 'attempt' as const, ...(await this.buildAttemptPayload(attempt)) };
    }

    return { mode: 'result' as const, ...(await this.buildResultPayload(attempt)) };
  }

  /**
   * Persists answers as the student works. Nothing is reported as saved until
   * the transaction commits, and an expired attempt is finalised instead.
   */
  async saveAnswers(
    tenantId: string,
    userId: string,
    attemptId: string,
    dto: SaveAnswersDto,
  ) {
    const student = await this.requireStudent(tenantId, userId);
    const attempt = await this.loadAttempt(tenantId, student.id, attemptId);

    if (attempt.status !== 'IN_PROGRESS') {
      return { saved: false as const, alreadySubmitted: true as const };
    }
    if (attempt.expiresAt <= new Date()) {
      await this.finalize(attempt, 'expired');
      return { saved: false as const, expired: true as const };
    }

    const examQuestions = await this.prisma.cbtExamQuestion.findMany({
      where: { examId: attempt.examId },
      select: { questionId: true },
    });
    const validQuestionIds = new Set(examQuestions.map((row) => row.questionId));
    const options = await this.prisma.cbtQuestionOption.findMany({
      where: { questionId: { in: [...validQuestionIds] } },
      select: { id: true, questionId: true },
    });
    const optionOwner = new Map(options.map((option) => [option.id, option.questionId]));

    const operations = [];
    let dropped = 0;

    for (const answer of dto.answers) {
      if (!validQuestionIds.has(answer.questionId)) {
        dropped += 1;
        continue;
      }
      const selected = answer.selectedOptionId ?? null;
      if (selected && optionOwner.get(selected) !== answer.questionId) {
        dropped += 1;
        continue;
      }
      operations.push(
        this.prisma.cbtExamAttemptAnswer.upsert({
          where: {
            attemptId_questionId: {
              attemptId: attempt.id,
              questionId: answer.questionId,
            },
          },
          update: {
            selectedOptionId: selected,
            markedForReview: answer.markedForReview,
          },
          create: {
            attemptId: attempt.id,
            questionId: answer.questionId,
            selectedOptionId: selected,
            markedForReview: answer.markedForReview,
          },
        }),
      );
    }

    if (operations.length === 0) {
      throw new BadRequestException('No valid answers were provided');
    }

    await this.prisma.$transaction(operations);

    return {
      saved: true as const,
      savedAt: new Date(),
      dropped,
      remainingSeconds: remainingSeconds(attempt.expiresAt),
    };
  }

  /** Scores on the server and closes the attempt. Repeat calls are idempotent. */
  async submit(
    tenantId: string,
    userId: string,
    attemptId: string,
    dto: SubmitAttemptDto,
  ) {
    const student = await this.requireStudent(tenantId, userId);
    const attempt = await this.loadAttempt(tenantId, student.id, attemptId);

    if (attempt.status !== 'IN_PROGRESS') {
      return {
        mode: 'result' as const,
        alreadySubmitted: true as const,
        autoTriggered: dto.auto === true,
        ...(await this.buildResultPayload(attempt)),
      };
    }

    const isExpired = attempt.expiresAt <= new Date();
    await this.finalize(attempt, isExpired ? 'expired' : 'submitted');

    const finalAttempt = await this.loadAttempt(tenantId, student.id, attemptId);
    return {
      mode: 'result' as const,
      autoTriggered: dto.auto === true,
      ...(await this.buildResultPayload(finalAttempt)),
    };
  }

  // --------------------------------------------------------------------------
  // Attempt resolution / scoring
  // --------------------------------------------------------------------------

  private async requireStudent(tenantId: string, userId: string) {
    return requireStudentRecord(this.prisma, tenantId, userId);
  }

  /** Loads an attempt only when it belongs to this tenant AND this student. */
  private async loadAttempt(
    tenantId: string,
    studentId: string,
    attemptId: string,
  ) {
    const attempt = await this.prisma.cbtExamAttempt.findFirst({
      where: { id: attemptId, tenantId, studentId },
      include: attemptInclude,
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    return attempt;
  }

  /**
   * Finalises an in-progress attempt: scores it on the backend and writes the
   * per-answer verdicts. Safe to call on an already-finalised attempt.
   */
  private async finalize(
    attempt: AttemptWithExam,
    reason: 'expired' | 'submitted',
  ) {
    if (attempt.status !== 'IN_PROGRESS') return;
    const exam = attempt.exam;

    const examQuestions = await this.prisma.cbtExamQuestion.findMany({
      where: { examId: exam.id },
      orderBy: { order: 'asc' },
      select: {
        questionId: true,
        marks: true,
        question: {
          select: {
            marks: true,
            options: { select: { id: true, isCorrect: true } },
          },
        },
      },
    });

    const scoringQuestions: ScoringQuestion[] = examQuestions.map((row) => ({
      questionId: row.questionId,
      marks: row.marks ?? row.question.marks,
      correctOptionIds: row.question.options
        .filter((option) => option.isCorrect)
        .map((option) => option.id),
    }));

    const result = scoreAttempt(
      scoringQuestions,
      attempt.answers.map((answer) => ({
        questionId: answer.questionId,
        selectedOptionId: answer.selectedOptionId,
      })),
      {
        negativeMarking: exam.negativeMarking,
        negativeMarkPerWrong: exam.negativeMarkPerWrong,
        passMark: exam.passMark,
      },
    );

    const now = new Date();
    const expired = reason === 'expired' || now.getTime() >= attempt.expiresAt.getTime();
    const submittedAt = expired ? attempt.expiresAt : now;

    // Group identical verdicts so a 100-question exam needs a handful of writes.
    const groups = new Map<
      string,
      { isCorrect: boolean; marksAwarded: number; questionIds: string[] }
    >();
    for (const question of result.questions) {
      const key = `${question.isCorrect}|${question.marksAwarded}`;
      const group = groups.get(key) ?? {
        isCorrect: question.isCorrect,
        marksAwarded: question.marksAwarded,
        questionIds: [],
      };
      group.questionIds.push(question.questionId);
      groups.set(key, group);
    }

    await this.prisma.$transaction([
      this.prisma.cbtExamAttempt.update({
        where: { id: attempt.id },
        data: {
          status: expired ? 'EXPIRED' : 'SUBMITTED',
          submittedAt,
          score: result.score,
          totalMarks: result.totalMarks,
          percentage: result.percentage,
          correctCount: result.correctCount,
          incorrectCount: result.incorrectCount,
          unansweredCount: result.unansweredCount,
          passed: result.passed,
          timeUsedSeconds: computeTimeUsedSeconds(
            attempt.startedAt,
            submittedAt,
            exam.durationMinutes,
          ),
        },
      }),
      ...[...groups.values()].map((group) =>
        this.prisma.cbtExamAttemptAnswer.updateMany({
          where: { attemptId: attempt.id, questionId: { in: group.questionIds } },
          data: { isCorrect: group.isCorrect, marksAwarded: group.marksAwarded },
        }),
      ),
    ]);
  }

  // --------------------------------------------------------------------------
  // Payload shaping
  // --------------------------------------------------------------------------

  /**
   * Payload for an in-progress attempt. Options deliberately omit `isCorrect`
   * and explanations — correct answers never leave the server mid-exam.
   */
  private async buildAttemptPayload(attempt: AttemptWithExam) {
    const exam = attempt.exam;

    const examQuestions = await this.prisma.cbtExamQuestion.findMany({
      where: { examId: exam.id },
      orderBy: { order: 'asc' },
      select: {
        questionId: true,
        marks: true,
        question: {
          select: {
            id: true,
            text: true,
            imageUrl: true,
            marks: true,
            difficulty: true,
            category: true,
            topicName: true,
            options: {
              orderBy: { order: 'asc' as const },
              select: { id: true, label: true, text: true },
            },
          },
        },
      },
    });

    let questions = examQuestions.map((row) => ({
      questionId: row.questionId,
      marks: row.marks ?? row.question.marks,
      text: row.question.text,
      imageUrl: row.question.imageUrl,
      difficulty: row.question.difficulty,
      category: row.question.category,
      topicName: row.question.topicName,
      options: row.question.options,
    }));

    if (exam.randomizeQuestions) {
      questions = cbtShuffle(questions, cbtHashSeed(attempt.id));
    }
    if (exam.randomizeOptions) {
      questions = questions.map((question) => ({
        ...question,
        options: cbtShuffle(
          question.options,
          cbtHashSeed(`${attempt.id}:${question.questionId}`),
        ),
      }));
    }

    const lastSavedAt = attempt.answers.reduce<Date | null>(
      (latest, answer) =>
        !latest || answer.updatedAt > latest ? answer.updatedAt : latest,
      null,
    );

    return {
      attempt: {
        id: attempt.id,
        examId: attempt.examId,
        attemptNumber: attempt.attemptNumber,
        status: attempt.status,
        startedAt: attempt.startedAt,
        expiresAt: attempt.expiresAt,
        remainingSeconds: remainingSeconds(attempt.expiresAt),
        lastSavedAt,
      },
      exam: {
        id: exam.id,
        title: exam.title,
        category: exam.category,
        mode: exam.mode,
        description: exam.description,
        instructions: exam.instructions,
        subject: exam.subject,
        durationMinutes: exam.durationMinutes,
        totalMarks: exam.totalMarks,
        passMark: exam.passMark,
        maxAttempts: exam.maxAttempts,
        randomizeQuestions: exam.randomizeQuestions,
        randomizeOptions: exam.randomizeOptions,
        showCorrectAnswers: exam.showCorrectAnswers,
        showResultImmediately: exam.showResultImmediately,
      },
      questions: questions.map((question, index) => ({
        index: index + 1,
        ...question,
      })),
      answers: attempt.answers.map((answer) => ({
        questionId: answer.questionId,
        selectedOptionId: answer.selectedOptionId,
        markedForReview: answer.markedForReview,
        updatedAt: answer.updatedAt,
      })),
    };
  }

  /** Result payload, honouring the exam's result-visibility settings. */
  private async buildResultPayload(attempt: AttemptWithExam) {
    const exam = attempt.exam;
    const visible = exam.showResultImmediately;
    const canReview = visible && exam.showCorrectAnswers;

    const base = {
      attempt: {
        id: attempt.id,
        examId: attempt.examId,
        attemptNumber: attempt.attemptNumber,
        status: attempt.status,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        timeUsedSeconds: attempt.timeUsedSeconds,
        ...(visible
          ? {
              score: attempt.score,
              totalMarks: attempt.totalMarks,
              percentage: attempt.percentage,
              passed: attempt.passed,
              correctCount: attempt.correctCount,
              incorrectCount: attempt.incorrectCount,
              unansweredCount: attempt.unansweredCount,
            }
          : {}),
      },
      exam: {
        id: exam.id,
        title: exam.title,
        category: exam.category,
        mode: exam.mode,
        subject: exam.subject,
        passMark: exam.passMark,
        durationMinutes: exam.durationMinutes,
        showResultImmediately: exam.showResultImmediately,
        showCorrectAnswers: exam.showCorrectAnswers,
        totalMarks: exam.totalMarks,
      },
      visible,
      canReview,
      review: null as null | unknown[],
    };

    if (!canReview) return base;

    const examQuestions = await this.prisma.cbtExamQuestion.findMany({
      where: { examId: exam.id },
      orderBy: { order: 'asc' },
      select: {
        questionId: true,
        marks: true,
        question: {
          select: {
            id: true,
            text: true,
            explanation: true,
            marks: true,
            options: {
              orderBy: { order: 'asc' as const },
              select: { id: true, label: true, text: true, isCorrect: true },
            },
          },
        },
      },
    });

    const answerByQuestion = new Map(
      attempt.answers.map((answer) => [answer.questionId, answer]),
    );

    let review = examQuestions.map((row) => {
      const answer = answerByQuestion.get(row.questionId);
      const marks = row.marks ?? row.question.marks;
      const awarded = answer?.marksAwarded ?? 0;
      return {
        questionId: row.questionId,
        text: row.question.text,
        explanation: row.question.explanation,
        marks,
        selectedOptionId: answer?.selectedOptionId ?? null,
        answered: !!answer?.selectedOptionId,
        isCorrect: answer?.isCorrect ?? false,
        marksAwarded: awarded,
        earnedPercent: marks > 0 ? Math.round((awarded / marks) * 100) : 0,
        options: row.question.options,
      };
    });

    // Same seeds as the attempt so the review matches what the student saw.
    if (exam.randomizeQuestions) {
      review = cbtShuffle(review, cbtHashSeed(attempt.id));
    }
    if (exam.randomizeOptions) {
      review = review.map((item) => ({
        ...item,
        options: cbtShuffle(
          item.options,
          cbtHashSeed(`${attempt.id}:${item.questionId}`),
        ),
      }));
    }

    return { ...base, review: review.map((item, index) => ({ index: index + 1, ...item })) };
  }
}
