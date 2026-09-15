import { z } from 'zod';

export const createGroupSchema = z.object({
  branchId: z
    .string()
    .trim()
    .min(1, 'Branch is required')
    .describe('ID of the branch the group belongs to'),
  name: z
    .string()
    .trim()
    .min(2, 'Group name is required')
    .max(200)
    .describe('Group name'),
  description: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .describe('Group description (max 500 characters)'),
});

export type CreateGroupDto = z.infer<typeof createGroupSchema>;

export const updateGroupSchema = createGroupSchema.partial();
export type UpdateGroupDto = z.infer<typeof updateGroupSchema>;

export const groupMembersSchema = z.object({
  staffRecordIds: z
    .array(z.string().trim().min(1))
    .min(1)
    .max(500)
    .describe('Staff record IDs to add or remove (1-500)'),
});

export type GroupMembersDto = z.infer<typeof groupMembersSchema>;
