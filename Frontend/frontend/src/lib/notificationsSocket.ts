import { io, type Socket } from 'socket.io-client'
import { getAccessToken, getAccessTokenCookie, getTenantId } from '../api/client'

let socket: Socket | null = null
const listeners = new Set<(event: string, payload: unknown) => void>()
const chatListeners = new Set<(event: string, payload: unknown) => void>()

/** Websocket origin: strip the /api/v1 prefix, fall back to the current origin in dev. */
function socketOrigin(): string {
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api/v1'
  const origin = base.replace(/\/api\/v1\/?$/, '')
  return origin || window.location.origin
}

export function subscribeNotifications(
  handler: (event: string, payload: unknown) => void,
): () => void {
  listeners.add(handler)
  return () => {
    listeners.delete(handler)
  }
}

/** Subscribe to all realtime chat events (`chat:` prefixed). */
export function subscribeChatEvents(
  handler: (event: string, payload: unknown) => void,
): () => void {
  chatListeners.add(handler)
  return () => {
    chatListeners.delete(handler)
  }
}

/** Emit a chat event (e.g. `chat:typing`, `chat:read`, `chat:join`) if connected. */
export function emitChatEvent(event: string, payload: unknown): void {
  socket?.emit(event, payload)
}

/** Connect (once) to the realtime gateway. Best-effort: polling is the fallback. */
export function connectNotificationsSocket(): void {
  if (socket) return
  try {
    const tenantId = getTenantId()
    const token = getAccessToken() ?? getAccessTokenCookie()
    if (!tenantId || !token) return
    socket = io(socketOrigin(), {
      transports: ['websocket', 'polling'],
      auth: { token, tenantId },
    })
    socket.on('notification:new', (payload: unknown) => {
      for (const l of listeners) l('notification:new', payload)
    })
    socket.onAny((event: string, payload: unknown) => {
      if (event.startsWith('chat:') && chatListeners.size > 0) {
        for (const l of chatListeners) l(event, payload)
      }
    })
    socket.on('connect_error', () => {
      // Realtime is optional; keep polling as the source of truth.
    })
  } catch {
    socket = null
  }
}

export function disconnectNotificationsSocket(): void {
  socket?.disconnect()
  socket = null
}