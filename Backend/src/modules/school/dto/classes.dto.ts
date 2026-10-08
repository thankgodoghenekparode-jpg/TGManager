import { z } from 'zod';

export const schoolProfileSchema = z.object({
  motto: z.string().trim().max(255).optional().nullable(),
  principalName: z.string().trim().max(150).optional().nullable(),
  schoolType: z.enum(['NURSERY', 'PRIMARY', 'SECONDARY', 'COMBINED', 'COLLEGE', 'OTHER']).default('SECONDARY'),
  ownershipType: z.enum(['PRIVATE', 'PUBLIC', 'MISSION', 'OTHER']).default('PRIVATE'),
  currency: z.string().trim().max(10).default('NGN'),
  openingTime: z.string().trim().regex(/^\d{2}:\d{2}$/).default('07:30'),
  lateThreshold: z.string().trim().regex(/^\d{2}:\d{2}$/).default('07:45'),
  geofenceRadius: z.number().positive().max(5000).default(200),
  address: z.string().trim().max(255).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  state: z.string().trim().max(100).optional().nullable(),
  country: z.string().trim().max(100).default('Nigeria'),
  phone: z.string().trim().max(50).optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
  website: z.string().trim().url().optional().nullable(),
  stampUrl: z.string().trim().url().optional().nullable(),
});

export type SchoolProfileDto = z.infer<typeof schoolProfileSchema>;

export const createAcademicSessionSchema = z.object({
  name: z.string().trim().min(4, 'Session name is required (e.g. 2026/2027)').max(50),
  isCurrent: z.boolean().default(false),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
});

export type CreateAcademicSessionDto = z.infer<typeof createAcademicSessionSchema>;

export const updateAcademicSessionSchema = createAcademicSessionSchema.partial();
export type UpdateAcademicSessionDto = z.infer<typeof updateAcademicSessionSchema>;

export const createTermSchema = z.object({
  sessionId: z.string().cuid('Session ID is required'),
  name: z.string().trim().min(2, 'Term name is required (e.g. First Term, Term 1)').max(50),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  status: z.enum(['UPCOMING', 'ACTIVE', 'COMPLETED']).default('UPCOMING'),
  isCurrent: z.boolean().default(false),
  resultEntryOpen: z.boolean().default(true),
  resultSubmissionDeadline: z.string().datetime().optional().nullable(),
  resultPublished: z.boolean().default(false),
});

export type CreateTermDto = z.infer<typeof createTermSchema>;

export const updateTermSchema = createTermSchema.partial();
export type UpdateTermDto = z.infer<typeof updateTermSchema>;

export const createClassRoomSchema = z.object({
  name: z.string().trim().min(1, 'Class name is required (e.g. JSS 1A, Grade 5)').max(100),
  level: z.string().trim().min(1, 'Level is required (e.g. JSS 1, Primary 5, SSS 2)').max(50),
  section: z.string().trim().max(50).optional().nullable(),
  capacity: z.number().int().min(1).max(500).default(40),
  sessionId: z.string().cuid().optional().nullable(),
  classTeacherId: z.string().cuid().optional().nullable(),
  status: z.string().default('ACTIVE'),
});

export type CreateClassRoomDto = z.infer<typeof createClassRoomSchema>;

export const updateClassRoomSchema = createClassRoomSchema.partial();
export type UpdateClassRoomDto = z.infer<typeof updateClassRoomSchema>;

export const createSubjectSchema = z.object({
  name: z.string().trim().min(2, 'Subject name is required').max(100),
  code: z.string().trim().min(1, 'Subject code is required (e.g. MTH, ENG)').max(20),
  description: z.string().trim().max(500).optional().nullable(),
  category: z.string().trim().max(50).optional().nullable(),
  status: z.string().default('ACTIVE'),
});

export type CreateSubjectDto = z.infer<typeof createSubjectSchema>;

export const updateSubjectSchema = createSubjectSchema.partial();
export type UpdateSubjectDto = z.infer<typeof updateSubjectSchema>;

export const assignClassSubjectSchema = z.object({
  subjectId: z.string().cuid('Subject ID is required'),
  teacherId: z.string().cuid().optional().nullable(),
});

export type AssignClassSubjectDto = z.infer<typeof assignClassSubjectSchema>;
