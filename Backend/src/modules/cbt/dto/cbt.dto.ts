import { z } from 'zod';
import {
  CBT_CATEGORIES,
  CBT_DIFFICULTIES,
  CBT_EXAM_MODES,
  CBT_EXAM_STATUSES,
  CBT_OPTION_LABELS,
  CBT_QUESTION_STATUSES,
  CBT_SOURCES,
} from '../cbt.constants';

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

const questionOptionSchema = z.object({
  label: z.enum(CBT_OPTION_LABELS).optional(),
  text: z.string().trim().min(1, 'Option text is required').max(1000),
  isCorrect: z.boolean().default(false),
  order: z.number().int().min(0).max(20).optional(),
});

export type QuestionOptionInput = z.infer<typeof questionOptionSchema>;

/** Shared rules for create/update: exactly one correct answer, unique labels. */
function refineOptions(
  options: QuestionOptionInput[] | undefined,
  ctx: z.RefinementCtx,
  path: (string | number)[] = ['options'],
) {
  if (!options) return;
  const correct = options.filter((o) => o.isCorrect).length;
  if (correct !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Exactly one option must be marked as the correct answer',
      path,
    });
  }
  const labels = options.map((o, i) => o.label ?? CBT_OPTION_LABELS[i] ?? `#${i + 1}`);
  if (new Set(labels).size !== labels.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Option labels must be unique',
      path,
    });
  }
}

export const createQuestionSchema = z
  .object({
    subjectId: z.string().cuid('A subject is required'),
    topicId: z.string().cuid().optional().nullable(),
    topicName: z.string().trim().min(1).max(150).optional().nullable(),
    category: z.enum(CBT_CATEGORIES).default('MOCK'),
    difficulty: z.enum(CBT_DIFFICULTIES).default('MEDIUM'),
    text: z.string().trim().min(3, 'Question text is required').max(4000),
    imageUrl: z.string().trim().max(500).optional().nullable(),
    explanation: z.string().trim().max(2000).optional().nullable(),
    marks: z.number().positive('Marks must be greater than 0').max(100).default(1),
    source: z.enum(CBT_SOURCES).default('SCHOOL'),
    status: z.enum(CBT_QUESTION_STATUSES).default('ACTIVE'),
    options: z
      .array(questionOptionSchema)
      .min(2, 'Provide at least two answer options')
      .max(8),
  })
  .superRefine((data, ctx) => refineOptions(data.options, ctx));

export type CreateQuestionDto = z.infer<typeof createQuestionSchema>;

export const updateQuestionSchema = z
  .object({
    subjectId: z.string().cuid().optional(),
    topicId: z.string().cuid().optional().nullable(),
    topicName: z.string().trim().min(1).max(150).optional().nullable(),
    category: z.enum(CBT_CATEGORIES).optional(),
    difficulty: z.enum(CBT_DIFFICULTIES).optional(),
    text: z.string().trim().min(3, 'Question text is required').max(4000).optional(),
    imageUrl: z.string().trim().max(500).optional().nullable(),
    explanation: z.string().trim().max(2000).optional().nullable(),
    marks: z.number().positive().max(100).optional(),
    source: z.enum(CBT_SOURCES).optional(),
    status: z.enum(CBT_QUESTION_STATUSES).optional(),
    options: z.array(questionOptionSchema).min(2).max(8).optional(),
  })
  .superRefine((data, ctx) => refineOptions(data.options, ctx));

export type UpdateQuestionDto = z.infer<typeof updateQuestionSchema>;

export const queryQuestionsSchema = z.object({
  subjectId: z.string().cuid().optional(),
  category: z.enum(CBT_CATEGORIES).optional(),
  difficulty: z.enum(CBT_DIFFICULTIES).optional(),
  status: z.enum(CBT_QUESTION_STATUSES).optional(),
  source: z.enum(CBT_SOURCES).optional(),
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type QueryQuestionsDto = z.infer<typeof queryQuestionsSchema>;

/** Raw CSV payload — parsed and validated on the server, never trusted client-side. */
export const importQuestionsSchema = z.object({
  csv: z.string().min(1, 'CSV content is required').max(1_000_000),
  dryRun: z.boolean().default(false),
});

export type ImportQuestionsDto = z.infer<typeof importQuestionsSchema>;

// ---------------------------------------------------------------------------
// Exams
// ---------------------------------------------------------------------------

export const createExamSchema = z
  .object({
    title: z.string().trim().min(3, 'Title is required').max(200),
    category: z.enum(CBT_CATEGORIES).default('MOCK'),
    mode: z.enum(CBT_EXAM_MODES).default('MOCK'),
    subjectId: z.string().cuid().optional().nullable(),
    classId: z.string().cuid().optional().nullable(),
    description: z.string().trim().max(1000).optional().nullable(),
    instructions: z.string().trim().max(4000).optional().nullable(),
    durationMinutes: z.number().int().min(1, 'Duration is required').max(600),
    passMark: z.number().min(0).max(100).default(50),
    questionIds: z.array(z.string().cuid()).max(1000).default([]),
    /** When no explicit questionIds are supplied, pick this many from the bank. */
    autoPickCount: z.number().int().min(0).max(1000).default(0),
    autoPickCategory: z.enum(CBT_CATEGORIES).optional(),
    randomizeQuestions: z.boolean().default(true),
    randomizeOptions: z.boolean().default(false),
    maxAttempts: z.number().int().min(1).max(100).default(1),
    showResultImmediately: z.boolean().default(true),
    showCorrectAnswers: z.boolean().default(false),
    negativeMarking: z.boolean().default(false),
    negativeMarkPerWrong: z.number().min(0).max(10).default(0),
    startAt: z.string().datetime().optional().nullable(),
    endAt: z.string().datetime().optional().nullable(),
    status: z.enum(CBT_EXAM_STATUSES).default('DRAFT'),
    assignClassId: z.string().cuid().optional().nullable(),
    assignStudentIds: z.array(z.string().cuid()).max(1000).default([]),
  })
  .superRefine((data, ctx) => {
    if (data.startAt && data.endAt && data.endAt <= data.startAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'End date must be after the start date',
        path: ['endAt'],
      });
    }
    if (data.questionIds.length === 0 && data.autoPickCount === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Select questions or choose how many to pick automatically',
        path: ['questionIds'],
      });
    }
    if (data.negativeMarking && data.negativeMarkPerWrong <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Set the marks deducted per wrong answer',
        path: ['negativeMarkPerWrong'],
      });
    }
  });

export type CreateExamDto = z.infer<typeof createExamSchema>;

export const updateExamSchema = z
  .object({
    title: z.string().trim().min(3).max(200).optional(),
    category: z.enum(CBT_CATEGORIES).optional(),
    mode: z.enum(CBT_EXAM_MODES).optional(),
    subjectId: z.string().cuid().optional().nullable(),
    classId: z.string().cuid().optional().nullable(),
    description: z.string().trim().max(1000).optional().nullable(),
    instructions: z.string().trim().max(4000).optional().nullable(),
    durationMinutes: z.number().int().min(1).max(600).optional(),
    passMark: z.number().min(0).max(100).optional(),
    randomizeQuestions: z.boolean().optional(),
    randomizeOptions: z.boolean().optional(),
    maxAttempts: z.number().int().min(1).max(100).optional(),
    showResultImmediately: z.boolean().optional(),
    showCorrectAnswers: z.boolean().optional(),
    negativeMarking: z.boolean().optional(),
    negativeMarkPerWrong: z.number().min(0).max(10).optional(),
    startAt: z.string().datetime().optional().nullable(),
    endAt: z.string().datetime().optional().nullable(),
    status: z.enum(CBT_EXAM_STATUSES).optional(),
    questionIds: z.array(z.string().cuid()).max(1000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.startAt && data.endAt && data.endAt <= data.startAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'End date must be after the start date',
        path: ['endAt'],
      });
    }
  });

export type UpdateExamDto = z.infer<typeof updateExamSchema>;

export const assignExamSchema = z
  .object({
    classId: z.string().cuid().optional().nullable(),
    studentIds: z.array(z.string().cuid()).max(1000).default([]),
    /** When true, existing assignments are dropped first. */
    replace: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (!data.classId && data.studentIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Choose a class or at least one student',
        path: ['studentIds'],
      });
    }
  });

export type AssignExamDto = z.infer<typeof assignExamSchema>;

export const queryExamsSchema = z.object({
  status: z.enum(CBT_EXAM_STATUSES).optional(),
  category: z.enum(CBT_CATEGORIES).optional(),
  mode: z.enum(CBT_EXAM_MODES).optional(),
  classId: z.string().cuid().optional(),
  subjectId: z.string().cuid().optional(),
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type QueryExamsDto = z.infer<typeof queryExamsSchema>;

// ---------------------------------------------------------------------------
// Attempts (student-facing)
// ---------------------------------------------------------------------------

export const startAttemptSchema = z.object({
  examId: z.string().cuid('Exam ID is required'),
});

export type StartAttemptDto = z.infer<typeof startAttemptSchema>;

const answerInputSchema = z.object({
  questionId: z.string().cuid('Question ID is required'),
  selectedOptionId: z.string().cuid().nullable().optional(),
  markedForReview: z.boolean().default(false),
});

export const saveAnswersSchema = z.object({
  answers: z
    .array(answerInputSchema)
    .min(1, 'Provide at least one answer to save')
    .max(2000),
});

export type SaveAnswersDto = z.infer<typeof saveAnswersSchema>;

export const submitAttemptSchema = z.object({
  /** Set by the client when the server clock ran out. */
  auto: z.boolean().optional(),
}).default({});

export type SubmitAttemptDto = z.infer<typeof submitAttemptSchema>;

// ---------------------------------------------------------------------------
// Reporting / analytics
// ---------------------------------------------------------------------------

export const attemptHistoryQuerySchema = z.object({
  examId: z.string().cuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export type AttemptHistoryQueryDto = z.infer<typeof attemptHistoryQuerySchema>;

export const examReportQuerySchema = z.object({
  examId: z.string().cuid('Exam ID is required'),
  classId: z.string().cuid().optional(),
  studentId: z.string().cuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type ExamReportQueryDto = z.infer<typeof examReportQuerySchema>;

export const performanceQuerySchema = z.object({
  classId: z.string().cuid().optional(),
  subjectId: z.string().cuid().optional(),
  studentId: z.string().cuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

export type PerformanceQueryDto = z.infer<typeof performanceQuerySchema>;
