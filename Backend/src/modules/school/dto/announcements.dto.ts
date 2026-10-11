import { z } from 'zod';

export const ANNOUNCEMENT_AUDIENCES = [
  'ALL',
  'STUDENTS',
  'PARENTS',
  'STAFF',
] as const;

export const createAnnouncementSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  content: z.string().trim().min(1, 'Content is required').max(5000),
  audience: z.enum(ANNOUNCEMENT_AUDIENCES).default('ALL'),
  publishedAt: z.string().datetime().optional().nullable(),
});

export type CreateAnnouncementDto = z.infer<typeof createAnnouncementSchema>;

export const updateAnnouncementSchema = createAnnouncementSchema.partial();
export type UpdateAnnouncementDto = z.infer<typeof updateAnnouncementSchema>;

export const queryAnnouncementsSchema = z.object({
  audience: z.enum(ANNOUNCEMENT_AUDIENCES).optional(),
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type QueryAnnouncementsDto = z.infer<typeof queryAnnouncementsSchema>;