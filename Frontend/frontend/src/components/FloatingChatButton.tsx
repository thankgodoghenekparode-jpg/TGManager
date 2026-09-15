import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge, Fab } from '@mui/material'
import ChatIcon from '@mui/icons-material/Chat'
import { chatApi } from '../api/chat'

const STORAGE_KEY = 'zarox:floating-chat-pos'
const SIZE = 56
const MARGIN = 8
const DRAG_THRESHOLD = 5

interface Pos {
  left: number
  top: number
}

function loadPos(): Pos | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as Pos).left === 'number' &&
      typeof (parsed as Pos).top === 'number'
    ) {
      return { left: (parsed as Pos).left, top: (parsed as Pos).top }
    }
    return null
  } catch {
    return null
  }
}

function savePos(pos: Pos) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pos))
  } catch {
    // storage unavailable (e.g. private mode) — position just won't persist
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function FloatingChatButton() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [pos, setPos] = useState<Pos | null>(() => loadPos())
  const latestPos = useRef<Pos | null>(pos)
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const wasDragged = useRef(false)

  const unread = useQuery({
    queryKey: ['floating-chat-unread'],
    queryFn: () => chatApi.unreadCount(),
    refetchInterval: 30_000,
  })

  if (pathname.startsWith('/app/chat')) return null

  return createPortal(
    <Fab
      size="medium"
      color="primary"
      aria-label="Open chat"
      onPointerDown={(e) => {
        wasDragged.current = false
        drag.current = { x: e.clientX, y: e.clientY, moved: false }
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (!drag.current) return
        const dx = e.clientX - drag.current.x
        const dy = e.clientY - drag.current.y
        if (Math.abs(dx) >= DRAG_THRESHOLD || Math.abs(dy) >= DRAG_THRESHOLD) {
          drag.current.moved = true
        }
        if (!drag.current.moved) return
        const vw = window.innerWidth
        const vh = window.innerHeight
        const next: Pos = {
          left: clamp(e.clientX - SIZE / 2, MARGIN, Math.max(MARGIN, vw - SIZE - MARGIN)),
          top: clamp(e.clientY - SIZE / 2, MARGIN, Math.max(MARGIN, vh - SIZE - MARGIN)),
        }
        latestPos.current = next
        setPos(next)
      }}
      onPointerUp={() => {
        if (drag.current?.moved) {
          wasDragged.current = true
          if (latestPos.current) savePos(latestPos.current)
        }
        drag.current = null
      }}
      onClick={() => {
        if (wasDragged.current) {
          wasDragged.current = false
          return
        }
        navigate('/app/chat')
      }}
      sx={{
        position: 'fixed',
        zIndex: (t) => t.zIndex.fab,
        ...(pos ? { left: pos.left, top: pos.top } : { right: { xs: 16, sm: 24 }, bottom: { xs: 16, sm: 24 } }),
        touchAction: 'none',
        cursor: 'grab',
        '&:active': { cursor: 'grabbing' },
        boxShadow: '0 10px 24px -8px rgba(37, 99, 235, 0.5)',
        '&:hover': { boxShadow: '0 12px 28px -8px rgba(15, 118, 110, 0.5)' },
      }}
    >
      <Badge
        color="error"
        badgeContent={(unread.data?.count ?? 0) > 99 ? '99+' : unread.data?.count ?? 0}
        invisible={!unread.data || unread.data.count === 0}
        sx={{ '& .MuiBadge-badge': { fontSize: 10, minWidth: 18, height: 18 } }}
      >
        <ChatIcon />
      </Badge>
    </Fab>,
    document.body,
  )
}