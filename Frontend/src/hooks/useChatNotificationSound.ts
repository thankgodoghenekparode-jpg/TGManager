import { useEffect, useRef } from 'react'
import {
  connectNotificationsSocket,
  subscribeChatEvents,
} from '../lib/notificationsSocket'
import { useAuthStore } from '../store/auth'

export const CHAT_SOUND_URL = '/sounds/chat-notification.wav'

/**
 * Plays a short chime whenever a chat message arrives from someone else,
 * once per second at most, and only while the tab is visible. Mount globally
 * (e.g. in the company layout) so the sound works on every page.
 */
export function useChatNotificationSound(enabled: boolean): void {
  const me = useAuthStore((s) => s.user)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const lastPlayedRef = useRef(0)

  useEffect(() => {
    if (!enabled || !me?.id) return
    connectNotificationsSocket()
    const unsub = subscribeChatEvents((event, payload) => {
      if (event !== 'chat:message') return
      const m = payload as { senderId?: string } | undefined
      if (!m?.senderId || m.senderId === me.id) return
      if (document.visibilityState !== 'visible') return
      const now = Date.now()
      if (now - lastPlayedRef.current < 1000) return
      lastPlayedRef.current = now

      const audio = audioRef.current ?? new Audio(CHAT_SOUND_URL)
      audioRef.current = audio
      audio.currentTime = 0
      audio.volume = 0.7
      void audio.play().catch(() => {})
    })
    return unsub
  }, [enabled, me?.id])
}