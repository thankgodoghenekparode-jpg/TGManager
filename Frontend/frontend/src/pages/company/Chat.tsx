import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import {
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputBase,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Popover,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import SearchIcon from '@mui/icons-material/Search'
import AddCommentIcon from '@mui/icons-material/AddComment'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import MicIcon from '@mui/icons-material/Mic'
import StopCircleIcon from '@mui/icons-material/StopCircle'
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions'
import ReplyIcon from '@mui/icons-material/Reply'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import ForwardIcon from '@mui/icons-material/Forward'
import DoneAllIcon from '@mui/icons-material/DoneAll'
import DoneIcon from '@mui/icons-material/Done'
import NotificationsIcon from '@mui/icons-material/Notifications'
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff'
import GroupAddIcon from '@mui/icons-material/GroupAdd'
import PersonRemoveIcon from '@mui/icons-material/PersonRemove'
import ExitToAppIcon from '@mui/icons-material/ExitToApp'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile'
import DownloadIcon from '@mui/icons-material/Download'
import PlayCircleIcon from '@mui/icons-material/PlayCircle'
import VoiceIcon from '@mui/icons-material/RecordVoiceOver'
import CloseIcon from '@mui/icons-material/Close'
import {
  chatApi,
  type ChatMessage,
  type Conversation,
  type MessageKind,
  type MessageReaction,
} from '../../api/chat'
import { staffApi } from '../../api/staff'
import { apiErrorMessage } from '../../api/client'
import { useAuthStore } from '../../store/auth'
import { useBlobUrl } from '../../hooks/useBlobUrl'
import { Can } from '../../components/PermissionGate'
import {
  connectNotificationsSocket,
  emitChatEvent,
  subscribeChatEvents,
} from '../../lib/notificationsSocket'

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏']

export function ChatPage() {
  const qc = useQueryClient()
  const me = useAuthStore((s) => s.user)
  const [selectedId, setSelectedId] = useState('')
  const [creating, setCreating] = useState(false)
  const [forward, setForward] = useState<ChatMessage | null>(null)
  const [query, setQuery] = useState('')
  const [liveOnline, setLiveOnline] = useState<Set<string>>(new Set())
  const [offline, setOffline] = useState<Set<string>>(new Set())

  const conversations = useQuery({
    queryKey: ['conversations'],
    queryFn: () => chatApi.listConversations(),
    refetchInterval: 15_000,
  })

  const presence = useQuery({
    queryKey: ['chat-presence'],
    queryFn: () => chatApi.presence(),
    refetchInterval: 30_000,
  })
  const onlineIds = useMemo(() => {
    const merged = new Set(presence.data?.onlineUserIds ?? [])
    for (const id of offline) merged.delete(id)
    for (const id of liveOnline) merged.add(id)
    return merged
  }, [presence.data, liveOnline, offline])

  const search = useQuery({
    queryKey: ['chat-search', query.trim()],
    queryFn: () => chatApi.search(query.trim()),
    enabled: query.trim().length >= 2,
  })

  useEffect(() => {
    connectNotificationsSocket()
    const unsub = subscribeChatEvents((event, payload) => {
      if (event === 'chat:presence' && payload && typeof payload === 'object') {
        const p = payload as { userId: string; status: string }
        if (p.status === 'online') {
          setLiveOnline((prev) => {
            const next = new Set(prev)
            next.add(p.userId)
            return next
          })
          setOffline((prev) => {
            if (!prev.has(p.userId)) return prev
            const next = new Set(prev)
            next.delete(p.userId)
            return next
          })
        } else {
          setOffline((prev) => {
            const next = new Set(prev)
            next.add(p.userId)
            return next
          })
          setLiveOnline((prev) => {
            if (!prev.has(p.userId)) return prev
            const next = new Set(prev)
            next.delete(p.userId)
            return next
          })
        }
      } else if (event === 'chat:message') {
        const m = payload as ChatMessage
        qc.setQueryData<Conversation[]>(['conversations'], (prev) => {
          if (!prev) return prev
          const target = prev.find((c) => c.id === m.conversationId)
          if (!target) return prev
          const rest = prev.filter((c) => c.id !== m.conversationId)
          const bump: Conversation = {
            ...target,
            lastMessageAt: m.createdAt,
            lastMessage: {
              id: m.id,
              senderId: m.senderId,
              kind: m.kind,
              body: m.body,
              createdAt: m.createdAt,
            },
            unreadCount:
              m.senderId === me?.id || selectedId === m.conversationId
                ? target.unreadCount
                : target.unreadCount + 1,
            updatedAt: m.createdAt,
          }
          return [bump, ...rest]
        })
      } else if (
        event === 'chat:conversation' ||
        event === 'chat:member_left' ||
        event === 'chat:message_deleted'
      ) {
        qc.invalidateQueries({ queryKey: ['conversations'] })
      }
    })
    return unsub
  }, [qc, me?.id, selectedId])

  const invalidate = () => qc.invalidateQueries({ queryKey: ['conversations'] })

  const selectConversation = (id: string) => {
    setSelectedId(id)
    void chatApi.markRead(id)
    emitChatEvent('chat:join', { conversationId: id })
    emitChatEvent('chat:read', { conversationId: id })
    void invalidate()
  }

  const filtered = useMemo(() => {
    const list = conversations.data ?? []
    if (!query.trim()) return list
    const q = query.trim().toLowerCase()
    const searchConvs = search.data?.conversations ?? []
    const qz = searchConvs.filter((c) => !list.some((x) => x.id === c.id))
    const byName = list.filter((c) => conversationTitle(c, me?.id ?? '').toLowerCase().includes(q))
    return [...new Map([...qz, ...byName].map((c) => [c.id, c])).values()]
  }, [conversations.data, search.data, query, me?.id])

  return (
    <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', md: 'row' }, height: { xs: 'auto', md: 'calc(100vh - 160px)' }, minHeight: { xs: 'calc(100vh - 190px)', md: 'auto' } }}>
      <Paper variant="outlined" sx={{ width: { xs: '100%', md: 340 }, display: 'flex', flexDirection: 'column', flexShrink: 0, maxHeight: { xs: '42vh', md: 'none' } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 1.5, pb: 0, flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="h6" fontWeight={700}>Chats</Typography>
          <Can permissions={['chat.create']}>
            <IconButton onClick={() => setCreating(true)} title="New conversation">
              <AddCommentIcon />
            </IconButton>
          </Can>
        </Stack>
        <Paper
          variant="outlined"
          sx={{
            m: 1.5,
            mt: 1,
            px: 1,
            display: 'flex',
            alignItems: 'center',
            borderRadius: 3,
          }}
        >
          <SearchIcon sx={{ color: 'text.secondary', mr: 0.5, fontSize: 20 }} />
          <InputBase
            fullWidth
            placeholder="Search chats, messages, people…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            sx={{ py: 0.75 }}
          />
          {query && (
            <IconButton size="small" onClick={() => setQuery('')}>
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </Paper>
        <Divider />
        <List dense sx={{ overflow: 'auto', flex: 1, px: 0.5 }}>
          {filtered.map((c) => (
            <ConversationItem
              key={c.id}
              c={c}
              meId={me?.id ?? ''}
              selected={selectedId === c.id}
              online={onlineIds.has(otherMember(c, me?.id ?? '')?.userId ?? '')}
              onSelect={selectConversation}
            />
          ))}
          {filtered.length === 0 && !conversations.isLoading && (
            <ListItem>
              <ListItemText primary="No conversations match." sx={{ textAlign: 'center' }} />
            </ListItem>
          )}
          {conversations.isLoading && (
            <Stack alignItems="center" sx={{ py: 3 }}>
              <CircularProgress size={22} />
            </Stack>
          )}
        </List>
        {search.data && query.trim().length >= 2 && (
          <SearchResultsBox
            results={search.data}
            onPickConv={(id) => selectConversation(id)}
            onPickUser={(id) => void chatApi.createConversation({ type: 'DIRECT', otherUserId: id }).then((c) => selectConversation(c.id))}
          />
        )}
      </Paper>

      <Paper variant="outlined" sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: { xs: '55vh', md: 0 } }}>
        {selectedId ? (
          <Thread
            conversationId={selectedId}
            meId={me?.id ?? ''}
            onlineIds={onlineIds}
            onForward={setForward}
            onConversationGone={() => setSelectedId('')}
          />
        ) : (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography color="text.secondary">Select a conversation to start chatting.</Typography>
          </Box>
        )}
      </Paper>

      {creating && (
        <NewConversationDialog
          onClose={() => setCreating(false)}
          onCreated={selectConversation}
        />
      )}
      {forward && (
        <ForwardDialog
          message={forward}
          onClose={() => setForward(null)}
          onDone={() => setForward(null)}
        />
      )}
    </Box>
  )
}

function ConversationItem({
  c,
  meId,
  selected,
  online,
  onSelect,
}: {
  c: Conversation
  meId: string
  selected: boolean
  online: boolean
  onSelect: (id: string) => void
}) {
  const title = conversationTitle(c, meId)
  const other = otherMember(c, meId)
  return (
    <ListItemButton
      selected={selected}
      onClick={() => onSelect(c.id)}
      sx={{ borderRadius: 2.5, px: 1, py: 0.75 }}
    >
      <ListItemAvatar sx={{ minWidth: 48 }}>
        <Badge
          overlap="circular"
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          variant="dot"
          color="success"
          invisible={!online}
        >
          <ConversationAvatar c={c} meId={meId} />
        </Badge>
      </ListItemAvatar>
      <ListItemText
        primary={
          <Stack direction="row" alignItems="center" spacing={0.5} justifyContent="space-between">
            <Typography variant="subtitle2" noWrap sx={{ fontWeight: 600, flex: 1 }}>
              {title}
            </Typography>
            {c.lastMessage && (
              <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                {timeLabel(c.lastMessage.createdAt)}
              </Typography>
            )}
          </Stack>
        }
        secondary={
          <Stack direction="row" alignItems="center" spacing={0.5}>
            {c.muted && <NotificationsOffIcon sx={{ fontSize: 13, color: 'text.secondary' }} />}
            <Typography variant="body2" color="text.secondary" noWrap sx={{ flex: 1 }}>
              {c.lastMessage ? messagePreview(c.lastMessage) : 'No messages yet'}
            </Typography>
            {c.unreadCount > 0 && (
              <Badge color="primary" badgeContent={c.unreadCount} sx={{ flexShrink: 0 }} />
            )}
          </Stack>
        }
      />
      {other?.user && c.type === 'DIRECT' && online && (
        <Typography variant="caption" color="success.main" sx={{ ml: 1, flexShrink: 0 }}>
          online
        </Typography>
      )}
    </ListItemButton>
  )
}

function ConversationAvatar({ c, meId }: { c: Conversation; meId: string }) {
  if (c.type === 'GROUP' || !otherMember(c, meId)?.user) {
    const names = c.members
      .filter((m) => m.userId !== meId)
      .slice(0, 2)
      .map((m) => `${m.user?.firstName ?? ''} ${m.user?.lastName ?? ''}`)
    const label = c.name || names.join(', ') || '?'
    return (
      <Avatar sx={{ bgcolor: 'primary.main', fontSize: 14 }}>{initials(label)}</Avatar>
    )
  }
  const u = otherMember(c, meId)?.user
  return (
    <Avatar src={u?.avatarUrl ?? undefined} sx={{ bgcolor: 'primary.light', fontSize: 14 }}>
      {u ? initials(`${u.firstName} ${u.lastName}`) : '?'}
    </Avatar>
  )
}

function Thread({
  conversationId,
  meId,
  onlineIds,
  onForward,
  onConversationGone,
}: {
  conversationId: string
  meId: string
  onlineIds: Set<string>
  onForward: (m: ChatMessage) => void
  onConversationGone: () => void
}) {
  const qc = useQueryClient()
  const [draft, setDraft] = useState('')
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const [editingId, setEditingId] = useState('')
  const [editText, setEditText] = useState('')
  const [error, setError] = useState('')
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({})
  const endRef = useRef<HTMLDivElement | null>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const conversation = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => chatApi.getConversation(conversationId),
  })
  const messages = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => chatApi.listMessages(conversationId, { limit: 50 }),
    refetchInterval: 15_000,
  })

  const ordered = useMemo(() => {
    const list = messages.data ?? []
    return [...list].reverse()
  }, [messages.data])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: ordered.length ? 'smooth' : 'auto' })
  }, [ordered.length])

  const markRead = () => {
    void chatApi.markRead(conversationId)
    emitChatEvent('chat:read', { conversationId })
  }

  useEffect(() => {
    markRead()
    const unsub = subscribeChatEvents((event, payload) => {
      const p = payload as Record<string, unknown>
      if (p.conversationId && p.conversationId !== conversationId) return
      if (event === 'chat:message') {
        const m = payload as ChatMessage
        qc.setQueryData<ChatMessage[]>(['messages', conversationId], (prev) => {
          if (!prev) return prev
          if (prev.some((x) => x.id === m.id)) return prev
          return [m, ...prev]
        })
        qc.setQueryData<Conversation>(['conversation', conversationId], (prev) =>
          prev
            ? { ...prev, lastMessageAt: m.createdAt, lastMessage: { id: m.id, senderId: m.senderId, kind: m.kind, body: m.body, createdAt: m.createdAt } }
            : prev,
        )
        if (m.senderId !== meId) markRead()
      } else if (event === 'chat:message_edited') {
        const m = payload as ChatMessage
        qc.setQueryData<ChatMessage[]>(['messages', conversationId], (prev) =>
          prev ? prev.map((x) => (x.id === m.id ? m : x)) : prev,
        )
      } else if (event === 'chat:message_deleted') {
        const { messageId, deletedAt } = p as { messageId: string; deletedAt: string }
        qc.setQueryData<ChatMessage[]>(['messages', conversationId], (prev) =>
          prev
            ? prev.map((x) => (x.id === messageId ? { ...x, deletedAt, body: null } : x))
            : prev,
        )
      } else if (event === 'chat:message_deleted_for_me') {
        const { messageId } = p as { messageId: string }
        qc.setQueryData<ChatMessage[]>(['messages', conversationId], (prev) =>
          prev ? prev.filter((x) => x.id !== messageId) : prev,
        )
      } else if (event === 'chat:reaction') {
        const { messageId, reactions } = p as { messageId: string; reactions: MessageReaction[] }
        qc.setQueryData<ChatMessage[]>(['messages', conversationId], (prev) =>
          prev ? prev.map((x) => (x.id === messageId ? { ...x, reactions } : x)) : prev,
        )
      } else if (event === 'chat:read') {
        const { userId, messageIds } = p as { userId: string; messageIds: string[] }
        const ids = new Set(messageIds ?? [])
        qc.setQueryData<ChatMessage[]>(['messages', conversationId], (prev) =>
          prev
            ? prev.map((x) =>
                ids.has(x.id)
                  ? { ...x, readBy: [{ userId, readAt: new Date().toISOString() }, ...x.readBy.filter((r) => r.userId !== userId)] }
                  : x,
              )
            : prev,
        )
      } else if (event === 'chat:typing') {
        const t = p as { userId: string; isTyping: boolean }
        if (t.userId === meId) return
        const members = conversation.data?.members ?? []
        const member = members.find((m) => m.userId === t.userId)
        const name = member?.user ? `${member.user.firstName} ${member.user.lastName}` : 'Someone'
        setTypingUsers((prev) => {
          const next = { ...prev }
          if (t.isTyping) next[t.userId] = name
          else delete next[t.userId]
          return next
        })
      } else if (event === 'chat:member_left') {
        const { userId } = p as { userId: string }
        if (userId === meId) {
          onConversationGone()
        } else {
          qc.invalidateQueries({ queryKey: ['conversation', conversationId] })
        }
      }
    })
    return () => {
      unsub()
      if (typingTimer.current) clearTimeout(typingTimer.current)
    }
  }, [conversationId, qc, meId, conversation.data]) // eslint-disable-line react-hooks/exhaustive-deps

  const sendTyping = (isTyping: boolean) => {
    emitChatEvent('chat:typing', { conversationId, isTyping })
  }

  const onDraftChange = (value: string) => {
    setDraft(value)
    if (typingTimer.current) clearTimeout(typingTimer.current)
    sendTyping(true)
    typingTimer.current = setTimeout(() => sendTyping(false), 2200)
  }

  const send = useMutation({
    mutationFn: (opts: { body?: string | null; documentIds?: string[] }) =>
      chatApi.sendMessage(conversationId, { ...opts, parentId: replyTo?.id ?? null }),
    onSuccess: () => {
      setDraft('')
      setReplyTo(null)
      if (typingTimer.current) clearTimeout(typingTimer.current)
      sendTyping(false)
      qc.invalidateQueries({ queryKey: ['messages', conversationId] })
      qc.invalidateQueries({ queryKey: ['conversation', conversationId] })
      qc.invalidateQueries({ queryKey: ['conversations'] })
    },
    onError: (e) => setError(apiErrorMessage(e)),
  })

  const members = conversation.data?.members ?? []
  const typingList = Object.values(typingUsers)
  const other = otherMember(conversation.data, meId)
  const onlineHere = other ? onlineIds.has(other.userId) : false
  const subtitle = typingList.length
    ? `${typingList.join(', ')} ${typingList.length === 1 ? 'is' : 'are'} typing…`
    : conversation.data?.type === 'DIRECT' && other?.user
      ? onlineHere
        ? 'Online'
        : 'Offline'
      : `${members.filter((m) => m.userId !== meId && m.user?.id).length} members`

  return (
    <>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.5}
        sx={{ p: 1.25, pl: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        {conversation.data
          ? <ConversationAvatar c={conversation.data} meId={meId} />
          : <Avatar sx={{ width: 26, height: 26, fontSize: 11 }} />
        }
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="subtitle1" fontWeight={700} noWrap>
            {conversation.data ? conversationTitle(conversation.data, meId) : 'Loading…'}
          </Typography>
          <Typography variant="caption" color={typingList.length ? 'primary.main' : 'text.secondary'} noWrap>
            {subtitle}
          </Typography>
        </Box>
        {conversation.data && (
          <ChatHeaderActions
            c={conversation.data}
            meId={meId}
            onError={setError}
            onUpdated={() => {
              qc.invalidateQueries({ queryKey: ['conversation', conversationId] })
              qc.invalidateQueries({ queryKey: ['conversations'] })
            }}
            onLeft={onConversationGone}
          />
        )}
      </Stack>
      {error && <Alert severity="error" sx={{ m: 1 }} onClose={() => setError('')}>{error}</Alert>}
      <Box sx={{ flex: 1, overflow: 'auto', px: 2, py: 1.5 }} className="chat-scroll">
        <Stack spacing={0.5}>
          {ordered.map((m, i) => (
            <DayDivider
              key={`d-${m.id}`}
              show={i === 0 || !dayjs(ordered[i - 1].createdAt).isSame(m.createdAt, 'day')}
              iso={m.createdAt}
            />
          ))}
          {ordered.map((m, i) => {
            const grouped = i > 0 && ordered[i - 1].senderId === m.senderId
            return (
              <MessageBubble
                key={m.id}
                message={m}
                mine={m.senderId === meId}
                grouped={grouped}
                members={members}
                editing={editingId === m.id}
                editText={editText}
                onEditText={setEditText}
                onEditStart={() => {
                  setEditingId(m.id)
                  setEditText(m.body ?? '')
                }}
                onEditCancel={() => setEditingId('')}
                onEditSave={() => {
                  if (editText.trim() && editingId) {
                    void chatApi
                      .editMessage(editingId, { body: editText.trim() })
                      .then((updated) => {
                        qc.setQueryData<ChatMessage[]>(['messages', conversationId], (prev) =>
                          prev ? prev.map((x) => (x.id === updated.id ? updated : x)) : prev,
                        )
                      })
                      .catch((e) => setError(apiErrorMessage(e)))
                  }
                  setEditingId('')
                }}
                onReply={() => setReplyTo(m)}
                onForward={() => onForward(m)}
                onReactionChange={(emoji) => {
                  const reacted = m.reactions.some((r) => r.emoji === emoji && r.reactedByMe)
                  const action = reacted
                    ? chatApi.removeReaction(m.id, emoji)
                    : chatApi.addReaction(m.id, emoji)
                  void action
                    .then((res) => {
                      qc.setQueryData<ChatMessage[]>(['messages', conversationId], (prev) =>
                        prev ? prev.map((x) => (x.id === m.id ? { ...x, reactions: res.reactions } : x)) : prev,
                      )
                    })
                    .catch((e) => setError(apiErrorMessage(e)))
                }}
                onDelete={(scope) => {
                  void chatApi
                    .deleteMessage(m.id, scope)
                    .then((updated) => {
                      qc.setQueryData<ChatMessage[]>(['messages', conversationId], (prev) =>
                        prev ? prev.map((x) => (x.id === m.id ? updated : x)) : prev,
                      )
                    })
                    .catch((e) => setError(apiErrorMessage(e)))
                }}
              />
            )
          })}
          {messages.isLoading && ordered.length === 0 && (
            <Stack alignItems="center" sx={{ py: 4 }}>
              <CircularProgress size={22} />
            </Stack>
          )}
          {conversation.data && ordered.length >= 50 && (
            <Button
              size="small"
              variant="text"
              onClick={() => {
                const oldest = ordered[0]
                qc.fetchQuery({
                  queryKey: ['messages-older', conversationId, oldest.id],
                  queryFn: () => chatApi.listMessages(conversationId, { limit: 50, cursor: oldest.id }),
                }).then((older) => {
                  qc.setQueryData<ChatMessage[]>(['messages', conversationId], (prev) => {
                    if (!prev) return prev
                    const existing = new Set(prev.map((x) => x.id))
                    const add = older.filter((x) => !existing.has(x.id))
                    return [...prev, ...add]
                  })
                })
              }}
              sx={{ alignSelf: 'center' }}
              startIcon={<ArrowUpwardIcon />}
            >
              Load earlier messages
            </Button>
          )}
          <div ref={endRef} />
        </Stack>
      </Box>
      <Composer
        conversationId={conversationId}
        draft={draft}
        onChange={onDraftChange}
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
        onSend={(body, docs) => send.mutate({ body, documentIds: docs })}
        pending={send.isPending}
        members={members}
        meId={meId}
        onError={setError}
      />
    </>
  )
}

function ChatHeaderActions({
  c,
  meId,
  onError,
  onUpdated,
  onLeft,
}: {
  c: Conversation
  meId: string
  onError: (msg: string) => void
  onUpdated: () => void
  onLeft: () => void
}) {
  const qc = useQueryClient()
  const [menu, setMenu] = useState<HTMLElement | null>(null)
  const [info, setInfo] = useState(false)
  const isGroup = c.type === 'GROUP'
  const isAdmin = c.myRole === 'ADMIN'

  const toggleMute = useMutation({
    mutationFn: () => chatApi.updateConversation(c.id, { muted: !c.muted }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] })
      qc.invalidateQueries({ queryKey: ['conversation', c.id] })
      void onUpdated()
    },
    onError: (e) => onError(apiErrorMessage(e)),
  })

  return (
    <>
      <Tooltip title={c.muted ? 'Unmute' : 'Mute'}>
        <IconButton onClick={() => toggleMute.mutate()}>
          {c.muted ? <NotificationsOffIcon /> : <NotificationsIcon />}
        </IconButton>
      </Tooltip>
      <IconButton onClick={(e) => setMenu(e.currentTarget)}>
        <MoreVertIcon />
      </IconButton>
      <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)}>
        <MenuItem onClick={() => { setInfo(true); setMenu(null) }}>
          <ListItemIcon><GroupAddIcon fontSize="small" /></ListItemIcon>
          {isGroup ? 'Group info / settings' : 'Conversation info'}
        </MenuItem>
        {isGroup && isAdmin && (
          <MenuItem onClick={() => { setInfo(true); setMenu(null) }}>
            <ListItemIcon><GroupAddIcon fontSize="small" /></ListItemIcon>
            Manage members
          </MenuItem>
        )}
        <MenuItem onClick={() => { setMenu(null); onLeft() }}>
          <ListItemIcon><ExitToAppIcon fontSize="small" /></ListItemIcon>
          Leave conversation
        </MenuItem>
      </Menu>
      {info && (
        <ConversationInfoDialog
          c={c}
          meId={meId}
          onClose={() => setInfo(false)}
          onError={onError}
          onUpdated={onUpdated}
          onLeft={onLeft}
        />
      )}
    </>
  )
}

function ConversationInfoDialog({
  c,
  meId,
  onClose,
  onError,
  onUpdated,
  onLeft,
}: {
  c: Conversation
  meId: string
  onClose: () => void
  onError: (msg: string) => void
  onUpdated: () => void
  onLeft: () => void
}) {
  const qc = useQueryClient()
  const [rename, setRename] = useState(c.name ?? '')
  const [adding, setAdding] = useState(false)

  const staff = useQuery({ queryKey: ['staff'], queryFn: () => staffApi.list() })

  const save = useMutation({
    mutationFn: () => chatApi.updateConversation(c.id, { name: rename.trim() || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] })
      qc.invalidateQueries({ queryKey: ['conversation', c.id] })
      void onUpdated()
    },
    onError: (e) => onError(apiErrorMessage(e)),
  })

  const addMember = useMutation({
    mutationFn: (ids: string[]) => chatApi.addMembers(c.id, ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversation', c.id] })
      qc.invalidateQueries({ queryKey: ['conversations'] })
      void onUpdated()
    },
    onError: (e) => onError(apiErrorMessage(e)),
  })

  const removeMember = useMutation({
    mutationFn: (userId: string) => chatApi.removeMember(c.id, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversation', c.id] })
      qc.invalidateQueries({ queryKey: ['conversations'] })
      void onUpdated()
    },
    onError: (e) => onError(apiErrorMessage(e)),
  })

  const isGroup = c.type === 'GROUP'
  const isAdmin = c.myRole === 'ADMIN'
  const memberIds = new Set(c.members.map((m) => m.userId))
  const availableUsers = (staff.data ?? []).filter((s) => !memberIds.has(s.user.id))

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{isGroup ? 'Group details' : 'Conversation details'}</DialogTitle>
      <DialogContent dividers sx={{ px: { xs: 2, sm: 3 } }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ flexWrap: 'wrap' }}>
            <ConversationAvatar c={c} meId={meId} />
            <Stack sx={{ minWidth: 0 }} flex={1}>
              <Typography variant="subtitle1" fontWeight={700}>{isGroup && c.name ? c.name : conversationTitle(c, meId)}</Typography>
              <Typography variant="caption" color="text.secondary">
                {c.members.length} member{c.members.length === 1 ? '' : 's'}
              </Typography>
            </Stack>
            <Switch
              checked={!c.muted}
              onChange={() => {
                void chatApi
                  .updateConversation(c.id, { muted: !c.muted })
                  .then(() => {
                    qc.invalidateQueries({ queryKey: ['conversations'] })
                    qc.invalidateQueries({ queryKey: ['conversation', c.id] })
                    void onUpdated()
                  })
                  .catch((e) => onError(apiErrorMessage(e)))
              }}
              inputProps={{ 'aria-label': 'notifications' }}
            />
          </Stack>

          {isGroup && isAdmin && (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap' }}>
              <TextField
                label="Group name"
                size="small"
                value={rename}
                onChange={(e) => setRename(e.target.value)}
                fullWidth
              />
              <Button variant="contained" size="medium" onClick={() => save.mutate()} disabled={save.isPending || rename.trim() === c.name}>
                Save
              </Button>
            </Stack>
          )}

          <Divider />

          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle2" fontWeight={700}>Members</Typography>
            {isGroup && isAdmin && !adding && (
              <Button size="small" startIcon={<GroupAddIcon />} onClick={() => setAdding(true)}>
                Add members
              </Button>
            )}
          </Stack>
          {adding && isGroup && isAdmin && (
            <Stack spacing={1}>
              <TextField
                select
                label="Add members"
                size="small"
                fullWidth
                value=""
                onChange={(e) => {
                  const id = e.target.value as string
                  if (id) {
                    addMember.mutate([id])
                    e.preventDefault()
                  }
                  setAdding(false)
                }}
              >
                {availableUsers.length === 0 && <MenuItem value="">No more tenant members</MenuItem>}
                {availableUsers.map((s) => (
                  <MenuItem key={s.user.id} value={s.user.id}>
                    {s.user.firstName} {s.user.lastName} ({s.user.email})
                  </MenuItem>
                ))}
              </TextField>
              <Button size="small" onClick={() => setAdding(false)}>Cancel</Button>
            </Stack>
          )}
          <List dense disablePadding>
            {c.members.map((m) => {
              const u = m.user
              const isMe = m.userId === meId
              return (
                <ListItem
                  key={m.userId}
                  secondaryAction={
                    isGroup && isAdmin && !isMe && m.role !== 'ADMIN' ? (
                      <Tooltip title="Remove member">
                        <IconButton
                          edge="end"
                          onClick={() => {
                            if (window.confirm(`Remove ${u?.firstName ?? 'member'} from this group?`)) {
                              removeMember.mutate(m.userId)
                            }
                          }}
                        >
                          <PersonRemoveIcon />
                        </IconButton>
                      </Tooltip>
                    ) : undefined
                  }
                >
                  <ListItemAvatar>
                    <Avatar src={u?.avatarUrl ?? undefined}>{u ? initials(`${u.firstName} ${u.lastName}`) : '?'}</Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={u ? `${u.firstName} ${u.lastName}` : 'Unknown'}
                    secondary={isMe ? 'You' : m.role === 'ADMIN' ? 'Admin' : 'Member'}
                  />
                </ListItem>
              )
            })}
          </List>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 2 }, flexWrap: 'wrap' }}>
        <Button onClick={() => { onClose(); onLeft() }} color="error" startIcon={<ExitToAppIcon />}>
          Leave conversation
        </Button>
        <Button onClick={onClose} variant="contained">Done</Button>
      </DialogActions>
    </Dialog>
  )
}

function Composer({
  conversationId,
  draft,
  onChange,
  replyTo,
  onClearReply,
  onSend,
  pending,
  members,
  meId,
  onError,
}: {
  conversationId: string
  draft: string
  onChange: (v: string) => void
  replyTo: ChatMessage | null
  onClearReply: () => void
  onSend: (body: string, documentIds: string[]) => void
  pending: boolean
  members: Array<{ userId: string; user?: { id: string; firstName: string; lastName: string } | undefined }>
  meId: string
  onError: (msg: string) => void
}) {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [recording, setRecording] = useState(false)
  const recRef = useRef<MediaRecorder | null>(null)
  const [uploading, setUploading] = useState(false)
  const [emojiAnchor, setEmojiAnchor] = useState<HTMLElement | null>(null)
  const others = members.filter((m) => m.userId !== meId && m.user)

  const { mentionMode, mentionQuery } = useMemo(() => {
    const text = draft
    const at = text.lastIndexOf('@')
    if (at < 0) return { mentionMode: false, mentionQuery: '' }
    const token = text.slice(at + 1)
    if (!token.includes('\n') && (token.length === 0 || !token.includes(' '))) {
      return { mentionMode: true, mentionQuery: token }
    }
    return { mentionMode: false, mentionQuery: '' }
  }, [draft])

  const detectedMentions = useMemo(() => {
    if (!mentionMode) return []
    const membersForSearch = others.map((m) =>
      m.user ? `${m.user.firstName} ${m.user.lastName}` : '',
    )
    return membersForSearch.filter((n) =>
      n.toLowerCase().includes(mentionQuery.toLowerCase()),
    )
  }, [mentionMode, mentionQuery, others])

  const insertMention = (name: string) => {
    const at = draft.lastIndexOf('@')
    onChange(`${draft.slice(0, at)}@${name} `)
  }

  const uploadAndSend = async (files: File[] | null) => {
    if (!files || files.length === 0) return
    if (uploading || pending) return
    setUploading(true)
    try {
      const caption = draft.trim()
      const count = Math.min(files.length, 5)
      for (let i = 0; i < count; i++) {
        const doc = await chatApi.uploadAttachment(conversationId, files[i], files[i].name)
        onSend(i === 0 ? caption : '', [doc.id])
      }
      onChange('')
    } catch (e) {
      onError(apiErrorMessage(e))
      onChange(draft)
    } finally {
      setUploading(false)
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const chunks: Blob[] = []
      const rec = new MediaRecorder(stream)
      rec.ondataavailable = (e) => chunks.push(e.data)
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' })
        setUploading(true)
        try {
          const doc = await chatApi.uploadAttachment(conversationId, blob, 'voice.webm')
          onSend('', [doc.id])
        } catch (e) {
          onError(apiErrorMessage(e))
        } finally {
          setUploading(false)
        }
      }
      recRef.current = rec
      rec.start()
      setRecording(true)
    } catch {
      setRecording(false)
    }
  }

  return (
    <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider' }}>
      {replyTo && (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1, flexWrap: 'wrap' }}>
          <ReplyIcon sx={{ fontSize: 16, color: 'primary.main', transform: 'scaleX(-1)' }} />
          <Box sx={{ flex: 1, bgcolor: 'action.hover', borderRadius: 1.5, px: 1.5, py: 0.75 }}>
            <Typography variant="caption" color="primary.main" fontWeight={700}>
              {replyTo.senderId === meId ? 'You' : replyTo.sender ? `${replyTo.sender.firstName} ${replyTo.sender.lastName}` : 'Someone'}
            </Typography>
            <Typography variant="body2" noWrap>{parentPreviewText(replyTo)}</Typography>
          </Box>
          <IconButton size="small" onClick={onClearReply}><CloseIcon fontSize="small" /></IconButton>
        </Stack>
      )}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'flex-end' }}>
        <input
          ref={fileRef}
          hidden
          type="file"
          multiple
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? [])
            e.currentTarget.value = ''
            if (picked.length > 0) void uploadAndSend(picked)
          }}
        />
        <IconButton onClick={() => fileRef.current?.click()} disabled={uploading || recording}>
          <AttachFileIcon />
        </IconButton>
        <IconButton onClick={(e) => setEmojiAnchor(e.currentTarget)} disabled={recording}>
          <EmojiEmotionsIcon />
        </IconButton>
        <TextField
          fullWidth
          size="small"
          multiline
          maxRows={4}
          placeholder="Type a message…"
          value={draft}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.repeat) return
            if (e.key === 'Enter' && !e.shiftKey && draft.trim() && !pending) {
              e.preventDefault()
              onSend(draft.trim(), [])
              onChange('')
            }
          }}
          disabled={uploading}
        />
        {recording ? (
          <IconButton onClick={() => { recRef.current?.stop(); setRecording(false) }} color="error">
            <StopCircleIcon />
          </IconButton>
        ) : (
          <IconButton onClick={() => void startRecording()} disabled={uploading}>
            <MicIcon />
          </IconButton>
        )}
        <Button
          variant="contained"
          disabled={uploading || pending || !draft.trim()}
          onClick={() => {
            onSend(draft.trim(), [])
            onChange('')
          }}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          <SendIcon />
        </Button>
      </Stack>
      {recording && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, color: 'error.main' }}>
          <VoiceIcon fontSize="small" />
          <Typography variant="body2">Recording… tap stop to send a voice message</Typography>
        </Box>
      )}
      {mentionMode && detectedMentions.length > 0 && (
        <Paper elevation={3} sx={{ position: 'absolute', mt: -16, maxHeight: 180, overflow: 'auto' }}>
          <List dense>
            {detectedMentions.map((n) => (
              <ListItemButton key={n} onClick={() => insertMention(n)}>
                <ListItemText primary={n} />
              </ListItemButton>
            ))}
          </List>
        </Paper>
      )}
      <EmojiMenu anchor={emojiAnchor} onClose={() => setEmojiAnchor(null)} onPick={(e) => { onChange(draft + e); setEmojiAnchor(null) }} />
    </Box>
  )
}

function EmojiMenu({
  anchor,
  onClose,
  onPick,
}: {
  anchor: HTMLElement | null
  onClose: () => void
  onPick: (emoji: string) => void
}) {
  return (
    <Popover
      open={Boolean(anchor)}
      anchorEl={anchor}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
    >
      <Box sx={{ p: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5, maxWidth: 220 }}>
        {REACTION_EMOJIS.concat(['🦄', '🎉', '🔥', '💯', '🤝', '👏']).map((e) => (
          <IconButton key={e} size="small" onClick={() => onPick(e)} sx={{ fontSize: 20 }}>
            {e}
          </IconButton>
        ))}
      </Box>
    </Popover>
  )
}

function MessageBubble({
  message,
  mine,
  grouped,
  members,
  editing,
  editText,
  onEditText,
  onEditStart,
  onEditCancel,
  onEditSave,
  onReply,
  onForward,
  onReactionChange,
  onDelete,
}: {
  message: ChatMessage
  mine: boolean
  grouped: boolean
  members: Array<{ userId: string; user?: { id: string; firstName: string; lastName: string } | undefined }>
  editing: boolean
  editText: string
  onEditText: (v: string) => void
  onEditStart: () => void
  onEditCancel: () => void
  onEditSave: () => void
  onReply: () => void
  onForward: () => void
  onReactionChange: (emoji: string) => void
  onDelete: (scope: 'me' | 'all') => void
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [reactionAnchor, setReactionAnchor] = useState<HTMLElement | null>(null)
  const [deleteDialog, setDeleteDialog] = useState(false)

  const senderName = message.sender
    ? `${message.sender.firstName} ${message.sender.lastName}`
    : ''
  const isGroup = members.length > 2

  const highlightBody = (text: string) => {
    const names = members
      .map((m) => (m.user ? `${m.user.firstName} ${m.user.lastName}` : ''))
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)
    const parts: Array<{ text: string; mention: boolean }> = []
    let rest = text
    while (rest.length) {
      let matched = false
      for (const name of names) {
        const idx = rest.indexOf(`@${name}`)
        if (idx === 0) {
          parts.push({ text: `@${name}`, mention: true })
          rest = rest.slice(`@${name}`.length)
          matched = true
          break
        }
      }
      if (matched) continue
      parts.push({ text: rest.charAt(0), mention: false })
      rest = rest.slice(1)
    }
    return parts.map((p, i) =>
      p.mention ? (
        <Box key={i} component="span" sx={{ color: mine ? '#fff' : 'primary.main', fontWeight: 700 }}>
          {p.text}
        </Box>
      ) : (
        <span key={i}>{p.text}</span>
      ),
    )
  }

  const bodyContent = () => {
    if (message.deletedAt) {
      return <Typography variant="body2" fontStyle="italic" sx={{ opacity: 0.7 }}>This message was deleted</Typography>
    }
    return (
      <Typography
        variant="body2"
        sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
        onClick={() => {}}
      >
        {highlightBody(message.body ?? '')}
      </Typography>
    )
  }

  return (
    <Box
      sx={{
        alignSelf: mine ? 'flex-end' : 'flex-start',
        maxWidth: { xs: '92%', sm: '72%' },
        display: 'flex',
        flexDirection: mine ? 'row-reverse' : 'row',
        alignItems: 'flex-end',
        gap: 0.75,
      }}
    >
      {!mine && !grouped && (
        <Avatar
          src={message.sender?.avatarUrl ?? undefined}
          sx={{ width: 26, height: 26, fontSize: 11, mb: 1.5 }}
        >
          {initials(senderName || '?')}
        </Avatar>
      )}
      <Box>
        {!mine && !grouped && isGroup && (
          <Typography variant="caption" color="text.secondary" sx={{ ml: 1, fontWeight: 600 }}>
            {senderName}
          </Typography>
        )}
        <Stack direction="row" alignItems="flex-end" spacing={0.5} sx={{ flexWrap: 'wrap', justifyContent: { xs: 'flex-start', sm: 'flex-end' } }}>
          <Box
            sx={{
              bgcolor: mine ? 'primary.main' : 'grey.200',
              color: mine ? 'primary.contrastText' : 'text.primary',
              borderRadius: grouped ? (mine ? '14px 4px 14px 14px' : '4px 14px 14px 14px') : '14px 14px',
              px: 1.5,
              py: 0.75,
              mt: grouped ? 0.25 : 1,
              maxWidth: { xs: '100%', sm: 420 },
            }}
          >
            {message.parent && (
              <Box
                sx={{
                  borderLeft: 3,
                  borderColor: mine ? 'rgba(255,255,255,0.7)' : 'primary.main',
                  bgcolor: mine ? 'rgba(255,255,255,0.15)' : 'rgba(25,118,210,0.08)',
                  borderRadius: 1,
                  px: 1,
                  py: 0.5,
                  mb: 0.5,
                }}
              >
                <Typography variant="caption" fontWeight={700} display="block">
                  {message.parent.senderName}
                </Typography>
                <Typography variant="body2" noWrap sx={{ maxWidth: '100%' }}>
                  {parentPreviewText(message.parent)}
                </Typography>
              </Box>
            )}
            <MessageMedia message={message} mine={mine} />
            {editing ? (
              <Stack direction="row" spacing={0.5} alignItems="center">
                <TextField
                  size="small"
                  fullWidth
                  autoFocus
                  value={editText}
                  onChange={(e) => onEditText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      onEditSave()
                    }
                    if (e.key === 'Escape') onEditCancel()
                  }}
                />
                <IconButton size="small" onClick={onEditSave} sx={{ color: 'inherit' }}>
                  <DoneIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={onEditCancel} sx={{ color: 'inherit' }}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Stack>
            ) : (
              bodyContent()
            )}
            {message.editedAt && !message.deletedAt && (
              <Typography variant="caption" sx={{ opacity: 0.7, fontSize: 10 }}>
                edited
              </Typography>
            )}
          </Box>
          <Box sx={{ opacity: 0.65, display: 'flex', alignItems: 'center', gap: 0.25 }}>
            <Typography variant="caption" fontSize={10}>{dayjs(message.createdAt).format('h:mm A')}</Typography>
            {mine && (
              message.readBy.length > 0 ? (
                <DoneAllIcon fontSize="inherit" sx={{ color: '#4fc3f7' }} />
              ) : (
                <DoneIcon fontSize="inherit" />
              )
            )}
          </Box>
        </Stack>
        {message.reactions.length > 0 && (
          <Stack direction="row" spacing={0.5} sx={{ mt: 0.25, flexWrap: 'wrap' }}>
            {message.reactions.map((r) => (
              <Chip
                key={r.emoji}
                size="small"
                label={`${r.emoji} ${r.count}`}
                variant={r.reactedByMe ? 'filled' : 'outlined'}
                color={r.reactedByMe ? 'primary' : 'default'}
                sx={{ height: 22, '& .MuiChip-label': { px: 0.75, fontSize: 12 } }}
                onClick={() => onReactionChange(r.emoji)}
              />
            ))}
          </Stack>
        )}
      </Box>
      <IconButton
        size="small"
        sx={{ opacity: 0.4, '&:hover': { opacity: 1 }, mb: 1.5 }}
        onClick={(e) => setAnchor(e.currentTarget)}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <MenuItem onClick={() => { setAnchor(null); onReply() }}><ListItemIcon><ReplyIcon fontSize="small" /></ListItemIcon>Reply</MenuItem>
        <MenuItem onClick={() => { setAnchor(null); setReactionAnchor(document.body) }}>
          <ListItemIcon><EmojiEmotionsIcon fontSize="small" /></ListItemIcon>React
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchor(null)
            void navigator.clipboard?.writeText(message.body ?? '').catch(() => undefined)
          }}
          disabled={!message.body}
        >
          <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon>Copy
        </MenuItem>
        {mine && !message.deletedAt && (
          <MenuItem onClick={() => { setAnchor(null); onEditStart() }}>
            <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>Edit
          </MenuItem>
        )}
        <MenuItem onClick={() => { setAnchor(null); onForward() }}>
          <ListItemIcon><ForwardIcon fontSize="small" /></ListItemIcon>Forward
        </MenuItem>
        {mine && (
          <MenuItem onClick={() => { setAnchor(null); setDeleteDialog(true) }}>
            <ListItemIcon><DeleteIcon fontSize="small" /></ListItemIcon>Delete
          </MenuItem>
        )}
      </Menu>
      <Popover
        open={Boolean(reactionAnchor)}
        anchorEl={reactionAnchor}
        onClose={() => setReactionAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Box sx={{ p: 0.5, display: 'flex', gap: 0.25 }}>
          {REACTION_EMOJIS.map((e) => (
            <IconButton key={e} size="small" onClick={() => { onReactionChange(e); setReactionAnchor(null) }}>
              {e}
            </IconButton>
          ))}
        </Box>
      </Popover>
      {deleteDialog && (
        <DeleteDialog
          onClose={() => setDeleteDialog(false)}
          onConfirm={(scope) => {
            onDelete(scope)
            setDeleteDialog(false)
          }}
        />
      )}
    </Box>
  )
}

function MessageMedia({ message, mine }: { message: ChatMessage; mine: boolean }) {
  const docId = message.documentId
  const url = useBlobUrl(docId, () => chatApi.getAttachment(docId ?? ''))
  if (!docId) return null
  if (message.kind === 'IMAGE') {
    return url ? (
      <img
        src={url}
        alt="attachment"
        style={{ maxWidth: '100%', maxHeight: 260, borderRadius: 8, display: 'block', cursor: 'pointer' }}
        onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
      />
    ) : (
      <Box sx={{ width: 220, height: 160, borderRadius: 2, bgcolor: 'rgba(128,128,128,0.2)' }} />
    )
  }
  if (message.kind === 'VIDEO') {
    return url ? (
      <video src={url} controls style={{ maxWidth: '100%', maxHeight: 260, borderRadius: 8, display: 'block' }} />
    ) : (
      <Box sx={{ width: 220, height: 80, borderRadius: 2, bgcolor: 'rgba(128,128,128,0.2)' }} />
    )
  }
  if (message.kind === 'VOICE') {
    return (
      <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0, width: '100%' }}>
        <IconButton size="small" disabled={!url} onClick={() => void new Audio(url as string).play()} sx={{ color: 'inherit' }}>
          <PlayCircleIcon />
        </IconButton>
        <audio src={url ?? undefined} controls style={{ display: 'none' }} />
        <Box sx={{ flex: 1, height: 28, borderRadius: 2, bgcolor: 'rgba(128,128,128,0.25)', display: 'flex', alignItems: 'center', px: 1 }}>
          <Typography variant="caption">Voice message</Typography>
        </Box>
      </Stack>
    )
  }
  if (message.kind === 'AUDIO') {
    return url ? (
      <audio src={url} controls style={{ width: '100%', maxWidth: '100%', display: 'block' }} />
    ) : (
      <Box sx={{ width: 220, height: 48, borderRadius: 2, bgcolor: 'rgba(128,128,128,0.2)' }} />
    )
  }
  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      component="a"
      href={url ?? undefined}
      download={message.document?.title || 'attachment'}
      sx={{
        mt: 0.5,
        p: 1,
        borderRadius: 1.5,
        bgcolor: mine ? 'rgba(255,255,255,0.15)' : 'rgba(128,128,128,0.2)',
        textDecoration: 'none',
        color: 'inherit',
        maxWidth: '100%',
        pointerEvents: url ? 'auto' : 'none',
      }}
    >
      <InsertDriveFileIcon />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" noWrap>{message.document?.title ?? 'Attachment'}</Typography>
        <Typography variant="caption" sx={{ opacity: 0.7 }}>
          {formatBytes(message.document?.sizeBytes ?? 0)}
        </Typography>
      </Box>
      <DownloadIcon fontSize="small" />
    </Stack>
  )
}

function DeleteDialog({ onClose, onConfirm }: { onClose: () => void; onConfirm: (scope: 'me' | 'all') => void }) {
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Delete message</DialogTitle>
      <DialogContent sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 1.5, sm: 2 } }}>
        <Typography variant="body2">
          Do you want to delete this message for yourself, or for everyone in the conversation?
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 2 }, flexWrap: 'wrap' }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={() => onConfirm('me')}>For me</Button>
        <Button color="error" onClick={() => onConfirm('all')}>For everyone</Button>
      </DialogActions>
    </Dialog>
  )
}

function DayDivider({ show, iso }: { show: boolean; iso: string }) {
  if (!show) return null
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ my: 1 }}>
      <Divider sx={{ flex: 1 }} />
      <Chip size="small" label={dayLabel(iso)} variant="outlined" />
      <Divider sx={{ flex: 1 }} />
    </Stack>
  )
}

function SearchResultsBox({
  results,
  onPickConv,
  onPickUser,
}: {
  results: { messages: ChatMessage[]; conversations: Conversation[]; users: Array<{ id: string; firstName: string; lastName: string; email: string; avatarUrl: string | null }> }
  onPickConv: (id: string) => void
  onPickUser: (id: string) => void
}) {
  const me = useAuthStore((s) => s.user)
  return (
    <Box sx={{ borderTop: 1, borderColor: 'divider', maxHeight: 200, overflow: 'auto' }}>
      {results.messages.slice(0, 5).map((m) => (
        <ListItemButton key={`m-${m.id}`} onClick={() => onPickConv(m.conversationId)}>
          <ListItemIcon><InsertDriveFileIcon fontSize="small" color="disabled" /></ListItemIcon>
          <ListItemText primary={<Typography variant="body2" noWrap>{m.body ?? parentPreviewText(m)}</Typography>} secondary={`${m.sender ? `${m.sender.firstName} ${m.sender.lastName}` : 'Message'} · ${timeLabel(m.createdAt)}`} />
        </ListItemButton>
      ))}
      {results.conversations.map((c) => (
        <ListItemButton key={`c-${c.id}`} onClick={() => onPickConv(c.id)}>
          <ListItemAvatar><ConversationAvatar c={c} meId={me?.id ?? ''} /></ListItemAvatar>
          <ListItemText primary={conversationTitle(c, me?.id ?? '')} secondary="Conversation" />
        </ListItemButton>
      ))}
      {results.users.map((u) => (
        <ListItemButton key={`u-${u.id}`} onClick={() => onPickUser(u.id)}>
          <ListItemAvatar><Avatar src={u.avatarUrl ?? undefined}>{initials(`${u.firstName} ${u.lastName}`)}</Avatar></ListItemAvatar>
          <ListItemText
            primary={`${u.firstName} ${u.lastName}`}
            secondary={<Typography variant="caption">Start a conversation</Typography>}
          />
        </ListItemButton>
      ))}
      {results.messages.length === 0 && results.conversations.length === 0 && results.users.length === 0 && (
        <ListItem><ListItemText primary="No results." sx={{ textAlign: 'center' }} /></ListItem>
      )}
    </Box>
  )
}

function NewConversationDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [type, setType] = useState<'DIRECT' | 'GROUP'>('DIRECT')
  const [otherUserId, setOtherUserId] = useState('')
  const [name, setName] = useState('')
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [error, setError] = useState('')

  const staff = useQuery({ queryKey: ['staff'], queryFn: () => staffApi.list() })

  const create = useMutation({
    mutationFn: () =>
      chatApi.createConversation(
        type === 'DIRECT' ? { type, otherUserId } : { type, name, memberIds },
      ),
    onSuccess: (conv) => {
      void onCreated(conv.id)
    },
    onError: (e) => setError(apiErrorMessage(e)),
  })

  const users = (staff.data ?? []).map((s) => ({
    id: s.user.id,
    name: `${s.user.firstName} ${s.user.lastName}`,
    email: s.user.email,
  }))

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>New conversation</DialogTitle>
      <DialogContent sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 1.5, sm: 2 } }}>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            select
            label="Type"
            value={type}
            onChange={(e) => setType(e.target.value as 'DIRECT' | 'GROUP')}
            fullWidth
          >
            <MenuItem value="DIRECT">Direct message</MenuItem>
            <MenuItem value="GROUP">Group chat</MenuItem>
          </TextField>
          {type === 'DIRECT' ? (
            <TextField select label="Person" value={otherUserId} onChange={(e) => setOtherUserId(e.target.value)} fullWidth>
              <MenuItem value="">Select…</MenuItem>
              {users.map((u) => (
                <MenuItem key={u.id} value={u.id}>{u.name} ({u.email})</MenuItem>
              ))}
            </TextField>
          ) : (
            <>
              <TextField label="Group name" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
              <TextField
                select
                label="Members"
                value={memberIds}
                onChange={(e) => setMemberIds(e.target.value as unknown as string[])}
                fullWidth
                SelectProps={{ multiple: true }}
              >
                {users.map((u) => (
                  <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>
                ))}
              </TextField>
            </>
          )}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 2 }, flexWrap: 'wrap' }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={
            create.isPending ||
            (type === 'DIRECT' && !otherUserId) ||
            (type === 'GROUP' && (!name || memberIds.length === 0))
          }
          onClick={() => create.mutate()}
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function ForwardDialog({ message, onClose, onDone }: { message: ChatMessage; onClose: () => void; onDone: () => void }) {
  const qc = useQueryClient()
  const me = useAuthStore((s) => s.user)
  const [target, setTarget] = useState('')
  const [error, setError] = useState('')

  const conversations = useQuery({
    queryKey: ['conversations'],
    queryFn: () => chatApi.listConversations(),
  })

  const forward = useMutation({
    mutationFn: (conversationId: string) =>
      chatApi.sendMessage(conversationId, {
        body: message.body,
        documentIds: message.documentId ? [message.documentId] : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] })
      setTarget('')
      void onDone()
    },
    onError: (e) => setError(apiErrorMessage(e)),
  })

  const candidates = (conversations.data ?? []).filter(
    (c) => c.id !== message.conversationId,
  )

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Forward message</DialogTitle>
      <DialogContent sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 1.5, sm: 2 } }}>
        <Box sx={{ bgcolor: 'action.hover', borderRadius: 1.5, px: 1.5, py: 1, mb: 2 }}>
          <Typography variant="body2" noWrap>{message.body ?? parentPreviewText(message)}</Typography>
        </Box>
        <TextField
          select
          label="Forward to"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          fullWidth
        >
          {candidates.map((c) => (
            <MenuItem key={c.id} value={c.id}>{conversationTitle(c, me?.id ?? '')}</MenuItem>
          ))}
        </TextField>
        {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 2 }, flexWrap: 'wrap' }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!target || forward.isPending}
          onClick={() => forward.mutate(target)}
        >
          Forward
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function otherMember(c: Conversation | undefined, meId: string) {
  return (c?.members ?? []).find((m) => m.userId !== meId)
}

function conversationTitle(c: Conversation, meId: string): string {
  if (c.name) return c.name
  const other = otherMember(c, meId)
  if (other?.user) return `${other.user.firstName} ${other.user.lastName}`
  return 'Conversation'
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase()
}

function timeLabel(iso: string): string {
  const d = dayjs(iso)
  if (d.isSame(dayjs(), 'day')) return d.format('h:mm A')
  if (d.isSame(dayjs().subtract(1, 'day'), 'day')) return 'Yesterday'
  return d.format('D MMM')
}

function dayLabel(iso: string): string {
  const d = dayjs(iso)
  const now = dayjs()
  if (d.isSame(now, 'day')) return 'Today'
  if (d.isSame(now.subtract(1, 'day'), 'day')) return 'Yesterday'
  if (d.isSame(now, 'year')) return d.format('D MMM')
  return d.format('D MMM YYYY')
}

function parentPreviewText(p: { kind: MessageKind; body: string | null }): string {
  if (p.body) return p.body
  return kindLabel(p.kind)
}

function messagePreview(m: { kind: MessageKind; body: string | null }): string {
  if (m.body) return m.body
  return kindLabel(m.kind)
}

function kindLabel(kind: MessageKind): string {
  if (kind === 'IMAGE') return '📷 Photo'
  if (kind === 'VIDEO') return '🎬 Video'
  if (kind === 'AUDIO') return '🎧 Audio'
  if (kind === 'VOICE') return '🎙️ Voice message'
  if (kind === 'FILE') return '📎 File'
  return '💬 Message'
}

function formatBytes(bytes: number): string {
  if (!bytes) return 'Attachment'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
