import { z } from 'zod';

export const createConversationSchema = z
  .object({
    type: z
      .enum(['DIRECT', 'GROUP'])
      .default('DIRECT')
      .describe('Conversation type (DIRECT or GROUP)'),
    name: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .optional()
      .nullable()
      .describe('Group conversation name (required for GROUP)'),
    otherUserId: z
      .string()
      .trim()
      .min(1)
      .optional()
      .nullable()
      .describe('Other participant user ID (required for DIRECT)'),
    memberIds: z
      .array(z.string().trim().min(1))
      .max(100)
      .optional()
      .describe('Member user IDs (required for GROUP)'),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'DIRECT' && !data.otherUserId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'otherUserId is required for DIRECT conversations',
        path: ['otherUserId'],
      });
    }
    if (data.type === 'GROUP' && (!data.name || !data.memberIds?.length)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'name and memberIds are required for GROUP conversations',
        path: ['type'],
      });
    }
  });

export type CreateConversationDto = z.infer<typeof createConversationSchema>;

export const sendMessageSchema = z
  .object({
    body: z
      .string()
      .trim()
      .max(4000)
      .optional()
      .nullable()
      .describe('Message text (max 4000 characters)'),
    documentIds: z
      .array(z.string().trim().min(1))
      .max(5)
      .optional()
      .describe('Optional document IDs to reference (max 5)'),
    parentId: z
      .string()
      .trim()
      .min(1)
      .optional()
      .nullable()
      .describe('Message ID being replied to'),
  })
  .superRefine((data, ctx) => {
    if (!data.body?.trim() && !data.documentIds?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide a message body or at least one document',
        path: ['body'],
      });
    }
  });

export type SendMessageDto = z.infer<typeof sendMessageSchema>;

export const messageHistorySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(50)
    .describe('Maximum messages to return (1-100, default 50)'),
  cursor: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe('Opaque pagination cursor'),
});

export type MessageHistoryDto = z.infer<typeof messageHistorySchema>;

export const socketSendMessageSchema = z
  .object({
    conversationId: z
      .string()
      .trim()
      .min(1)
      .describe('Conversation ID to send the message in'),
    body: z
      .string()
      .trim()
      .max(4000)
      .optional()
      .nullable()
      .describe('Message text (max 4000 characters)'),
    documentIds: z
      .array(z.string().trim().min(1))
      .max(5)
      .optional()
      .describe('Optional document IDs to reference (max 5)'),
    parentId: z
      .string()
      .trim()
      .min(1)
      .optional()
      .nullable()
      .describe('Message ID being replied to'),
  })
  .superRefine((data, ctx) => {
    if (!data.body?.trim() && !data.documentIds?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide a message body or at least one document',
        path: ['body'],
      });
    }
    if (!data.conversationId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'conversationId is required',
        path: ['conversationId'],
      });
    }
  });

export type SocketSendMessageDto = z.infer<typeof socketSendMessageSchema>;

export const socketJoinSchema = z.object({
  conversationId: z.string().trim().min(1).describe('Conversation ID to join'),
});

export type SocketJoinDto = z.infer<typeof socketJoinSchema>;

export const editMessageSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Message body is required')
    .max(4000)
    .describe('Replacement message text'),
});

export type EditMessageDto = z.infer<typeof editMessageSchema>;

export const reactionSchema = z.object({
  emoji: z
    .string()
    .trim()
    .min(1)
    .max(32)
    .describe('Emoji reaction (e.g. 👍, ❤️, 😂)'),
});

export type ReactionDto = z.infer<typeof reactionSchema>;

export const updateConversationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .optional()
    .nullable()
    .describe('New group conversation name'),
  muted: z
    .boolean()
    .optional()
    .describe('Mute or unmute this conversation for the current user'),
});

export type UpdateConversationDto = z.infer<typeof updateConversationSchema>;

export const addMembersSchema = z.object({
  memberIds: z
    .array(z.string().trim().min(1))
    .min(1)
    .max(100)
    .describe('User IDs to add to the group'),
});

export type AddMembersDto = z.infer<typeof addMembersSchema>;

export const searchChatSchema = z.object({
  q: z
    .string()
    .trim()
    .min(1, 'Search query is required')
    .max(200)
    .describe('Search term'),
  kind: z
    .enum(['messages', 'conversations', 'users'])
    .optional()
    .describe('Scope of the search'),
});

export type SearchChatDto = z.infer<typeof searchChatSchema>;

export const socketTypingSchema = z.object({
  conversationId: z.string().trim().min(1).describe('Conversation ID'),
  isTyping: z.boolean().describe('Whether the user is currently typing'),
});

export type SocketTypingDto = z.infer<typeof socketTypingSchema>;

export const callKindSchema = z.enum(['VOICE', 'VIDEO']);

export type CallKind = z.infer<typeof callKindSchema>;

export const socketCallRingSchema = z.object({
  conversationId: z
    .string()
    .trim()
    .min(1)
    .describe('Direct conversation to call in'),
  kind: callKindSchema.describe('VOICE or VIDEO call'),
});

export type SocketCallRingDto = z.infer<typeof socketCallRingSchema>;

export const socketCallAckSchema = z.object({
  callId: z.string().trim().min(1).describe('Call ID to acknowledge'),
});

export type SocketCallAckDto = z.infer<typeof socketCallAckSchema>;

export const socketCallSdpSchema = z.object({
  callId: z.string().trim().min(1).describe('Call ID'),
  sdp: z.string().min(1).describe('SDP offer or answer'),
});

export type SocketCallSdpDto = z.infer<typeof socketCallSdpSchema>;

export const socketCallIceSchema = z.object({
  callId: z.string().trim().min(1).describe('Call ID'),
  candidate: z
    .string()
    .min(1)
    .nullish()
    .describe('ICE candidate JSON string (null signals end of candidates)'),
});

export type SocketCallIceDto = z.infer<typeof socketCallIceSchema>;
