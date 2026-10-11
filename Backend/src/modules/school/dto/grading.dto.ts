import { z } from 'zod';

export const createGradingScaleSchema = z.object({
  name: z.string().trim().default('Standard'),
  minScore: z.number().min(0).max(100),
  maxScore: z.number().min(0).max(100),
  grade: z.string().trim().min(1).max(5),
  remark: z.string().trim().min(1).max(100),
  gradePoint: z.number().min(0).max(10).optional().nullable(),
});

export type CreateGradingScaleDto = z.infer<typeof createGradingScaleSchema>;

export const createAssessmentComponentSchema = z.object({
  name: z.string().trim().min(1, 'Component name is required (e.g. 1st CA, Exam)').max(100),
  weightPercent: z.number().min(0).max(100),
  maxScore: z.number().positive().max(100),
});

export type CreateAssessmentComponentDto = z.infer<typeof createAssessmentComponentSchema>;

export const studentScoreEntrySchema = z.object({
  studentId: z.string().cuid('Student ID is required'),
  assignmentScore: z.number().min(0).max(100).optional().nullable(),
  testScore: z.number().min(0).max(100).optional().nullable(),
  caScore: z.number().min(0).max(100).default(0),
  examScore: z.number().min(0).max(100).default(0),
  remark: z.string().trim().max(255).optional().nullable(),
});

export const recordClassResultsSchema = z.object({
  classId: z.string().cuid('Class ID is required'),
  subjectId: z.string().cuid('Subject ID is required'),
  sessionId: z.string().cuid('Session ID is required'),
  termId: z.string().cuid('Term ID is required'),
  scores: z.array(studentScoreEntrySchema).min(1, 'Scores array cannot be empty'),
});

export type RecordClassResultsDto = z.infer<typeof recordClassResultsSchema>;

export const queryResultsSchema = z.object({
  classId: z.string().cuid().optional(),
  subjectId: z.string().cuid().optional(),
  sessionId: z.string().cuid().optional(),
  termId: z.string().cuid().optional(),
  studentId: z.string().cuid().optional(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'PUBLISHED']).optional(),
});

export type QueryResultsDto = z.infer<typeof queryResultsSchema>;

export const approveResultsSchema = z.object({
  classId: z.string().cuid(),
  subjectId: z.string().cuid().optional(),
  sessionId: z.string().cuid(),
  termId: z.string().cuid(),
  action: z.enum(['APPROVE', 'REJECT', 'PUBLISH']),
  notes: z.string().trim().max(500).optional().nullable(),
});

export type ApproveResultsDto = z.infer<typeof approveResultsSchema>;

export const classResultsSheetQuerySchema = z.object({
  classId: z.string().cuid('Class ID is required'),
  sessionId: z.string().cuid('Session ID is required'),
  termId: z.string().cuid('Term ID is required'),
});

export type ClassResultsSheetQueryDto = z.infer<
  typeof classResultsSheetQuerySchema
>;
