import { api } from './client'

export type ConversationType = 'DIRECT' | 'GROUP'
export type MessageKind = 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'VOICE'

export interface ChatUser {
  id: string
  firstName: string
  lastName: string
  email: string
  avatarUrl: string | null
}

export interface ConversationMember {
  id: string
  conversationId: string
  userId: string
  joinedAt: string
  muted: boolean
  role: string
  user?: ChatUser
}

export interface MessageReaction {
  emoji: string
  count: number
  reactedByMe: boolean
}

export interface ParentPreview {
  id: string
  kind: MessageKind
  body: string | null
  senderId: string
  createdAt: string
  senderName: string
}

export interface DocRef {
  id: string
  title: string
  mimeType: string | null
  sizeBytes: number | null
}

export interface ChatAttachment {
  id: string
  tenantId: string
  branchId: string | null
  createdByUserId: string
  type: string
  title: string
  mimeType: string | null
  sizeBytes: string | null
  createdAt: string
  updatedAt: string
}

export interface MessageRead {
  userId: string
  readAt: string
}

export interface ChatMessage {
  id: string
  conversationId: string
  senderId: string
  kind: MessageKind
  body: string | null
  documentId: string | null
  document: DocRef | null
  parentId: string | null
  parent: ParentPreview | null
  editedAt: string | null
  deletedAt: string | null
  createdAt: string
  sender: ChatUser | null
  reactions: MessageReaction[]
  readByMe: boolean
  readBy: MessageRead[]
}

export interface Conversation {
  id: string
  tenantId: string
  type: ConversationType
  name: string | null
  createdByUserId: string
  createdAt: string
  updatedAt: string
  lastMessageAt: string | null
  muted: boolean
  myRole: string
  unreadCount: number
  members: ConversationMember[]
  lastMessage: {
    id: string
    senderId: string
    kind: MessageKind
    body: string | null
    createdAt: string
  } | null
  _count?: { messages: number }
}

export interface SearchResults {
  messages: ChatMessage[]
  conversations: Conversation[]
  users: ChatUser[]
}

export interface ReactionState {
  added: boolean
  reactions: Array<{
    emoji: string
    count: number
    reactedByMe: boolean
  }>
}

export const chatApi = {
  listConversations() {
    return api.get<Conversation[]>('/chat/conversations').then((r) => r.data)
  },
  getConversation(id: string) {
    return api.get<Conversation>(`/chat/conversations/${id}`).then((r) => r.data)
  },
  unreadCount() {
    return api.get<{ count: number }>('/chat/unread-count').then((r) => r.data)
  },
  createConversation(body: {
    type: ConversationType
    otherUserId?: string
    name?: string
    memberIds?: string[]
  }) {
    return api.post<Conversation>('/chat/conversations', body).then((r) => r.data)
  },
  listMessages(
    conversationId: string,
    query?: { limit?: number; cursor?: string },
  ) {
    return api
      .get<ChatMessage[]>(`/chat/conversations/${conversationId}/messages`, {
        params: query,
      })
      .then((r) => r.data)
  },
  sendMessage(
    conversationId: string,
    body: { body?: string | null; documentIds?: string[]; parentId?: string | null },
  ) {
    return api
      .post<ChatMessage>(`/chat/conversations/${conversationId}/messages`, body)
      .then((r) => r.data)
  },
  uploadAttachment(conversationId: string, file: Blob, filename?: string) {
    const fd = new FormData()
    fd.append('file', file, filename ?? 'file')
    return api
      .post<ChatAttachment>(
        `/chat/conversations/${conversationId}/attachments`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      .then((r) => r.data)
  },
  getAttachment(id: string) {
    return api
      .get<Blob>(`/chat/attachments/${id}`, { responseType: 'blob' })
      .then((r) => r.data)
  },
  editMessage(id: string, body: { body: string }) {
    return api.patch<ChatMessage>(`/chat/messages/${id}`, body).then((r) => r.data)
  },
  deleteMessage(id: string, scope: 'me' | 'all') {
    return api
      .delete<ChatMessage>(`/chat/messages/${id}`, { params: { scope } })
      .then((r) => r.data)
  },
  addReaction(id: string, emoji: string) {
    return api.post<ReactionState>(`/chat/messages/${id}/reactions`, { emoji }).then((r) => r.data)
  },
  removeReaction(id: string, emoji: string) {
    return api
      .delete<{ reactions: ReactionState['reactions'] }>(`/chat/messages/${id}/reactions/${encodeURIComponent(emoji)}`)
      .then((r) => r.data)
  },
  search(q: string, kind?: 'messages' | 'conversations' | 'users') {
    return api
      .get<SearchResults>('/chat/search', { params: { q, kind } })
      .then((r) => r.data)
  },
  presence() {
    return api.get<{ onlineUserIds: string[] }>('/chat/presence').then((r) => r.data)
  },
  markRead(conversationId: string) {
    return api
      .post<{ marked: number; messageIds: string[] }>(`/chat/conversations/${conversationId}/read`)
      .then((r) => r.data)
  },
  updateConversation(conversationId: string, body: { name?: string | null; muted?: boolean }) {
    return api
      .patch<Conversation>(`/chat/conversations/${conversationId}`, body)
      .then((r) => r.data)
  },
  leaveConversation(conversationId: string) {
    return api
      .post<{ deleted: boolean }>(`/chat/conversations/${conversationId}/leave`)
      .then((r) => r.data)
  },
  addMembers(conversationId: string, memberIds: string[]) {
    return api
      .post<Conversation>(`/chat/conversations/${conversationId}/members`, { memberIds })
      .then((r) => r.data)
  },
  removeMember(conversationId: string, userId: string) {
    return api
      .delete<Conversation>(`/chat/conversations/${conversationId}/members/${userId}`)
      .then((r) => r.data)
  },
}