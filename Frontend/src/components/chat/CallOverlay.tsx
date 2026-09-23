import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Avatar,
  Box,
  CircularProgress,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import CallEndIcon from '@mui/icons-material/CallEnd'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import VideocamIcon from '@mui/icons-material/Videocam'
import VideocamOffIcon from '@mui/icons-material/VideocamOff'
import VolumeOffIcon from '@mui/icons-material/VolumeOff'
import VolumeUpIcon from '@mui/icons-material/VolumeUp'
import PhoneIcon from '@mui/icons-material/Phone'
import { chatApi, type IceServer } from '../../api/chat'
import { emitChatEvent, subscribeChatEvents } from '../../lib/notificationsSocket'
import { CallContext, type CallContextValue, type CallKind, type CallPeer } from './callContext'

type CallStatus = 'idle' | 'ringing' | 'connecting' | 'active' | 'ended'
type EndReason = 'ended' | 'declined' | 'cancelled' | 'no_answer' | 'disconnected' | 'failed'

interface CallSession {
  callId: string
  conversationId: string
  kind: CallKind
  mode: 'outgoing' | 'incoming'
  peer: CallPeer
}

const RING_TIMEOUT_MS = 45_000

let iceServersPromise: Promise<IceServer[]> | null = null

function loadIceServers(): Promise<IceServer[]> {
  iceServersPromise ??= chatApi
    .getCallConfig()
    .then((c) => c.iceServers)
    .catch(() => [{ urls: 'stun:stun.l.google.com:19302' }])
  return iceServersPromise
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase() || '?'
}

let audioCtx: AudioContext | null = null

function sharedAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx =
      typeof window !== 'undefined' && window.AudioContext
        ? new AudioContext()
        : (null as never)
  }
  if (audioCtx && audioCtx.state === 'suspended') void audioCtx.resume()
  return audioCtx
}

function playTone(ctx: AudioContext, freq: number, start: number, duration: number): void {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.15, start)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(start)
  osc.stop(start + duration)
}

function chime(ctx: AudioContext): void {
  const now = ctx.currentTime
  playTone(ctx, 620, now, 0.28)
  playTone(ctx, 820, now + 0.3, 0.28)
  playTone(ctx, 620, now + 0.6, 0.28)
  playTone(ctx, 820, now + 0.9, 0.42)
}

let ringTimer: ReturnType<typeof setInterval> | null = null

function startRingtone(): void {
  stopRingtone()
  try {
    const ctx = sharedAudioContext()
    chime(ctx)
    ringTimer = setInterval(() => {
      try {
        chime(sharedAudioContext())
      } catch {
        /* noop */
      }
    }, 3200)
  } catch {
    /* WebAudio unavailable */
  }
  try {
    navigator.vibrate?.(500)
  } catch {
    /* noop */
  }
}

function stopRingtone(): void {
  if (ringTimer) clearInterval(ringTimer)
  ringTimer = null
  try {
    navigator.vibrate?.(0)
  } catch {
    /* noop */
  }
}

function formatElapsed(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`
}

interface UseCallResult {
  status: CallStatus
  session: CallSession | null
  reason: EndReason | null
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  micMuted: boolean
  videoOff: boolean
  speakerOn: boolean
  elapsed: number
  busy: boolean
  placeCall: (opts: { conversationId: string; kind: CallKind; peer: CallPeer }) => void
  accept: () => void
  decline: () => void
  cancel: () => void
  hangup: () => void
  toggleMute: () => void
  toggleVideo: () => void
  toggleSpeaker: () => void
}

function useCall(): UseCallResult {
  const [status, setStatus] = useState<CallStatus>('idle')
  const [session, setSession] = useState<CallSession | null>(null)
  const [reason, setReason] = useState<EndReason | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [micMuted, setMicMuted] = useState(false)
  const [videoOff, setVideoOff] = useState(false)
  const [speakerOn, setSpeakerOn] = useState(true)
  const [elapsed, setElapsed] = useState(0)
  const [activeSince, setActiveSince] = useState(0)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localRef = useRef<MediaStream | null>(null)
  const remoteRef = useRef<MediaStream | null>(null)
  const sessionRef = useRef<CallSession | null>(null)
  const statusRef = useRef<CallStatus>('idle')
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const raceGuardRef = useRef(0)

  const setBoth = useCallback((s: CallStatus) => {
    statusRef.current = s
    setStatus(s)
  }, [])

  const setSessionBoth = useCallback((s: CallSession | null) => {
    sessionRef.current = s
    setSession(s)
  }, [])

  const stopLocalStream = useCallback(() => {
    localRef.current?.getTracks().forEach((t) => t.stop())
    localRef.current = null
    setLocalStream(null)
  }, [])

  const closePeer = useCallback(() => {
    const pc = pcRef.current
    pcRef.current = null
    try {
      pc?.getSenders().forEach((s) => s.track?.stop())
      void pc?.close()
    } catch {
      /* noop */
    }
  }, [])

  const reset = useCallback(() => {
    if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current)
    ringTimeoutRef.current = null
    stopRingtone()
    closePeer()
    stopLocalStream()
    remoteRef.current = null
    setRemoteStream(null)
    setMicMuted(false)
    setVideoOff(false)
    setSpeakerOn(true)
    setElapsed(0)
    setActiveSince(0)
    setBoth('idle')
  }, [closePeer, setBoth, stopLocalStream])

  const ensurePeer = useCallback(async (): Promise<RTCPeerConnection> => {
    if (pcRef.current) return pcRef.current
    const config = { iceServers: await loadIceServers() }
    const pc = new RTCPeerConnection(config)
    pcRef.current = pc

    pc.onicecandidate = (event) => {
      const s = sessionRef.current
      if (!s) return
      if (event.candidate) {
        emitChatEvent('chat:call:ice', {
          callId: s.callId,
          candidate: JSON.stringify(event.candidate.toJSON()),
        })
      } else {
        emitChatEvent('chat:call:ice', {
          callId: s.callId,
          candidate: null,
        })
      }
    }

    pc.ontrack = (event) => {
      const stream = event.streams[0] ?? new MediaStream([event.track])
      remoteRef.current = stream
      setRemoteStream(stream)
      setActiveSince(Date.now())
      setBoth('active')
    }

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState
      if (
        state === 'failed' ||
        state === 'closed' ||
        state === 'disconnected'
      ) {
        const s = sessionRef.current
        if (!s) return
        if (statusRef.current === 'active' || statusRef.current === 'connecting') {
          setReason('disconnected')
          reset()
        }
      } else if (state === 'connected') {
        setActiveSince(Date.now())
        setBoth('active')
      }
    }

    return pc
  }, [reset, setBoth, setActiveSince])

  const attachLocal = useCallback(
    async (kind: CallKind) => {
      if (localRef.current) return localRef.current
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: kind === 'VIDEO',
      })
      localRef.current = stream
      setLocalStream(stream)
      return stream
    },
    [],
  )

  const teardownToEnded = useCallback(
    (r: EndReason) => {
      setReason(r)
      closePeer()
      stopLocalStream()
      remoteRef.current = null
      setRemoteStream(null)
      stopRingtone()
      if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current)
      ringTimeoutRef.current = null
      setElapsed(0)
      setBoth('ended')
      setTimeout(() => reset(), 2600)
    },
    [closePeer, reset, setBoth, stopLocalStream],
  )

  const outgoingTimedOut = useCallback(() => {
    const s = sessionRef.current
    if (!s || s.mode !== 'outgoing') return
    emitChatEvent('chat:call:cancel', { callId: s.callId })
    teardownToEnded('no_answer')
  }, [teardownToEnded])

  const incomingTimedOut = useCallback(() => {
    const s = sessionRef.current
    if (!s || s.mode !== 'incoming') return
    emitChatEvent('chat:call:decline', { callId: s.callId })
    teardownToEnded('no_answer')
  }, [teardownToEnded])

  const placeCall = useCallback(
    (opts: { conversationId: string; kind: CallKind; peer: CallPeer }) => {
      if (statusRef.current !== 'idle') return
      const s: CallSession = {
        callId: '',
        conversationId: opts.conversationId,
        kind: opts.kind,
        mode: 'outgoing',
        peer: opts.peer,
      }
      setSessionBoth(s)
      setReason(null)
      setBoth('ringing')
      startRingtone()
      void attachLocal(opts.kind).catch(() => {
        if (sessionRef.current === s && statusRef.current === 'ringing') {
          emitChatEvent('chat:call:cancel', { callId: s.callId })
          reset()
        }
        return
      })
      emitChatEvent(
        'chat:call:ring',
        { conversationId: opts.conversationId, kind: opts.kind },
        (res) => {
          const ack = res as { ok?: boolean; callId?: string; error?: string }
          if (!ack.ok || !ack.callId) {
            if (sessionRef.current === s && statusRef.current === 'ringing') {
              teardownToEnded('failed')
            }
            return
          }
          if (sessionRef.current === s && s.callId === '') {
            const updated: CallSession = { ...s, callId: ack.callId }
            sessionRef.current = updated
            setSessionBoth(updated)
          }
          if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current)
          ringTimeoutRef.current = setTimeout(() => outgoingTimedOut(), RING_TIMEOUT_MS)
        },
      )
    },
    [attachLocal, outgoingTimedOut, reset, setBoth, setSessionBoth, teardownToEnded],
  )

  const accept = useCallback(() => {
    const s = sessionRef.current
    if (!s || s.mode !== 'incoming') return
    stopRingtone()
    setBoth('connecting')
    emitChatEvent('chat:call:accept', { callId: s.callId })
    void attachLocal(s.kind).catch(() => {
      emitChatEvent('chat:call:decline', { callId: s.callId })
      reset()
    })
  }, [attachLocal, reset, setBoth])

  const decline = useCallback(() => {
    const s = sessionRef.current
    if (!s || s.mode !== 'incoming') return
    stopRingtone()
    emitChatEvent('chat:call:decline', { callId: s.callId })
    setSessionBoth(null)
    reset()
  }, [reset, setSessionBoth])

  const cancel = useCallback(() => {
    const s = sessionRef.current
    if (!s || s.mode !== 'outgoing') return
    stopRingtone()
    emitChatEvent('chat:call:cancel', { callId: s.callId })
    setSessionBoth(null)
    reset()
  }, [reset, setSessionBoth])

  const hangup = useCallback(() => {
    const s = sessionRef.current
    if (!s) return
    stopRingtone()
    emitChatEvent('chat:call:end', { callId: s.callId })
    teardownToEnded('ended')
  }, [teardownToEnded])

  const handleOffer = useCallback(
    async (callId: string, sdp: string) => {
      const s = sessionRef.current
      if (!s || s.callId !== callId || pcRef.current || statusRef.current === 'idle') return
      const local = localRef.current ?? (await attachLocal(s.kind).catch(() => null))
      if (!local) {
        teardownToEnded('failed')
        return
      }
      const pc = await ensurePeer()
      local.getAudioTracks().forEach((t) => pc.addTrack(t, local))
      if (s.kind === 'VIDEO') {
        local.getVideoTracks().forEach((t) => pc.addTrack(t, local))
      }
      try {
        await pc.setRemoteDescription({ type: 'offer', sdp })
        await pc.setLocalDescription(await pc.createAnswer())
        emitChatEvent('chat:call:answer', { callId, sdp: pc.localDescription?.sdp ?? '' })
      } catch {
        teardownToEnded('failed')
      }
    },
    [attachLocal, ensurePeer, teardownToEnded],
  )

  const handleAnswer = useCallback(
    async (callId: string, sdp: string) => {
      const s = sessionRef.current
      const pc = pcRef.current
      if (!s || s.callId !== callId || !pc) return
      try {
        await pc.setRemoteDescription({ type: 'answer', sdp })
      } catch {
        /* races are possible; the connection state handler covers cleanup */
      }
    },
    [],
  )

  const handleIce = useCallback(
    async (callId: string, candidate: string | null) => {
      const s = sessionRef.current
      const pc = pcRef.current
      if (!s || s.callId !== callId || !pc || !pc.remoteDescription) return
      try {
        if (candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(JSON.parse(candidate) as RTCIceCandidateInit))
        } else {
          await pc.addIceCandidate()
        }
      } catch {
        /* ignore invalid/raced candidates */
      }
    },
    [],
  )

  useEffect(() => {
    const unsub = subscribeChatEvents((event, payload) => {
      if (!event.startsWith('chat:call:') || event === 'chat:call:ring') return
      const p = payload as Record<string, unknown>
      const callId = String(p.callId ?? '')
      if (event === 'chat:call:accepted') {
        if (statusRef.current !== 'ringing' || sessionRef.current?.callId !== callId) return
        const s = sessionRef.current
        void (async () => {
          setBoth('connecting')
          const pc = await ensurePeer()
          const local = await attachLocal(s.kind).catch(() => null)
          if (!local) {
            teardownToEnded('failed')
            return
          }
          local.getAudioTracks().forEach((t) => pc.addTrack(t, local))
          if (s.kind === 'VIDEO') {
            local.getVideoTracks().forEach((t) => pc.addTrack(t, local))
          }
          try {
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            emitChatEvent('chat:call:offer', { callId, sdp: pc.localDescription?.sdp ?? '' })
          } catch {
            teardownToEnded('failed')
          }
        })()
      } else if (event === 'chat:call:declined') {
        if (sessionRef.current?.callId === callId && statusRef.current !== 'idle') {
          teardownToEnded('declined')
        }
      } else if (event === 'chat:call:cancelled') {
        if (sessionRef.current?.callId === callId && statusRef.current !== 'idle') {
          teardownToEnded('cancelled')
        }
      } else if (event === 'chat:call:offer') {
        void handleOffer(callId, String(p.sdp ?? ''))
      } else if (event === 'chat:call:answer') {
        void handleAnswer(callId, String(p.sdp ?? ''))
      } else if (event === 'chat:call:ice') {
        void handleIce(callId, p.candidate == null ? null : String(p.candidate))
      } else if (event === 'chat:call:ended' || event === 'chat:call:ended_disconnect') {
        if (sessionRef.current?.callId === callId && statusRef.current !== 'idle') {
          teardownToEnded(event === 'chat:call:ended_disconnect' ? 'disconnected' : 'ended')
        }
      }
    })
    return unsub
  }, [attachLocal, ensurePeer, handleAnswer, handleIce, handleOffer, setBoth, teardownToEnded])

  useEffect(() => {
    const unsub = subscribeChatEvents((event, payload) => {
      if (event !== 'chat:call:ring') return
      const p = payload as {
        callId: string
        conversationId: string
        kind: CallKind
        caller: CallPeer | null
      }
      const guard = raceGuardRef.current + 1
      raceGuardRef.current = guard
      if (statusRef.current !== 'idle') {
        emitChatEvent('chat:call:decline', { callId: p.callId })
        return
      }
      const caller = p.caller ?? { id: 'unknown', firstName: 'Unknown', lastName: '', avatarUrl: null }
      const s: CallSession = {
        callId: p.callId,
        conversationId: p.conversationId,
        kind: p.kind === 'VIDEO' ? 'VIDEO' : 'VOICE',
        mode: 'incoming',
        peer: caller,
      }
      setSessionBoth(s)
      setReason(null)
      setBoth('ringing')
      startRingtone()
      ringTimeoutRef.current = setTimeout(() => {
        if (raceGuardRef.current === guard) incomingTimedOut()
      }, RING_TIMEOUT_MS)
    })
    return unsub
  }, [incomingTimedOut, setBoth, setSessionBoth])

  useEffect(() => {
    if (status !== 'active') return
    const start = activeSince || Date.now()
    const interval = setInterval(() => setElapsed(activeSince ? (Date.now() - start) / 1000 : 0), 1000)
    return () => clearInterval(interval)
  }, [status, activeSince])

  const toggleMute = useCallback(() => {
    localRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = micMuted
    })
    setMicMuted((m) => !m)
  }, [micMuted])

  const toggleVideo = useCallback(() => {
    localRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = videoOff
    })
    setVideoOff((v) => !v)
  }, [videoOff])

  const toggleSpeaker = useCallback(() => {
    setSpeakerOn((s) => !s)
  }, [])

  return useMemo(
    () => ({
      status,
      session,
      reason,
      localStream,
      remoteStream,
      micMuted,
      videoOff,
      speakerOn,
      elapsed,
      busy: status !== 'idle',
      placeCall,
      accept,
      decline,
      cancel,
      hangup,
      toggleMute,
      toggleVideo,
      toggleSpeaker,
    }),
    [
      status,
      session,
      reason,
      localStream,
      remoteStream,
      micMuted,
      videoOff,
      speakerOn,
      elapsed,
      placeCall,
      accept,
      decline,
      cancel,
      hangup,
      toggleMute,
      toggleVideo,
      toggleSpeaker,
    ],
  )
}

export function CallProvider({ children }: { children: ReactNode }) {
  const call = useCall()
  const value = useMemo<CallContextValue>(
    () => ({ placeCall: call.placeCall, busy: call.busy }),
    [call.placeCall, call.busy],
  )
  return (
    <CallContext.Provider value={value}>
      {children}
      <CallOverlay call={call} />
    </CallContext.Provider>
  )
}

function CallOverlay({ call }: { call: UseCallResult }) {
  const { status, session, reason, localStream, remoteStream, micMuted, videoOff, speakerOn, elapsed } = call
  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const el = localVideoRef.current
    if (el && localStream) el.srcObject = localStream
  }, [localStream])

  useEffect(() => {
    const el = remoteVideoRef.current
    if (el && remoteStream && session?.kind === 'VIDEO') el.srcObject = remoteStream
  }, [remoteStream, session?.kind])

  useEffect(() => {
    const el = remoteAudioRef.current
    if (el && remoteStream) el.srcObject = remoteStream
  }, [remoteStream])

  useEffect(() => {
    const el = remoteAudioRef.current
    if (el) el.muted = !speakerOn
  }, [speakerOn])

  const busy = status !== 'idle'
  const peer = session?.peer

  const mutedIcon = speakerOn ? <VolumeUpIcon /> : <VolumeOffIcon />

  if (!busy || !session || !peer) return null

  const title = `${peer.firstName} ${peer.lastName}`.trim()
  const kindLabel = session.kind === 'VIDEO' ? 'Video call' : 'Voice call'

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: (t) => t.zIndex.drawer + 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'rgba(2, 6, 23, 0.92)',
        color: '#fff',
        p: 2,
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        {status === 'active' && session.kind === 'VIDEO' && (
          <Box sx={{ position: 'relative', width: '100%', aspectRatio: '16 / 10', borderRadius: 3, overflow: 'hidden', bgcolor: 'rgba(255,255,255,0.06)' }}>
            <video ref={remoteVideoRef} autoPlay playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            {!videoOff && (
              <video
                ref={localVideoRef}
                muted
                autoPlay
                playsInline
                style={{ position: 'absolute', right: 12, bottom: 12, width: '30%', aspectRatio: '3 / 4', objectFit: 'cover', borderRadius: 10, border: '2px solid rgba(255,255,255,0.5)', background: '#000' }}
              />
            )}
            <audio ref={remoteAudioRef} autoPlay playsInline />
          </Box>
        )}

        {status === 'active' && session.kind === 'VOICE' && (
          <>
            <audio ref={remoteAudioRef} autoPlay playsInline />
            <Avatar src={peer.avatarUrl ?? undefined} sx={{ width: 96, height: 96, fontSize: 36, bgcolor: 'primary.main' }}>
              {initials(title)}
            </Avatar>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>{title}</Typography>
            <Typography variant="body2" color="rgb(255 255 255 / 0.6)">Voice call · {formatElapsed(elapsed)}</Typography>
          </>
        )}

        {status === 'ringing' && (
          <>
            <Avatar src={peer.avatarUrl ?? undefined} sx={{ width: 96, height: 96, fontSize: 36, bgcolor: 'primary.main' }}>
              {initials(title)}
            </Avatar>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>{title}</Typography>
            <Typography variant="body2" color="rgb(255 255 255 / 0.6)">
              {session.mode === 'outgoing' ? `Calling… (${kindLabel})` : `Incoming ${kindLabel.toLowerCase()}`}
            </Typography>
          </>
        )}

        {status === 'connecting' && (
          <>
            <CircularProgress sx={{ color: '#fff' }} size={44} />
            <Typography variant="body2" color="rgb(255 255 255 / 0.6)">Connecting…</Typography>
          </>
        )}

        {status === 'ended' && (
          <>
            <Avatar src={peer.avatarUrl ?? undefined} sx={{ width: 96, height: 96, fontSize: 36, bgcolor: 'primary.main' }}>
              {initials(title)}
            </Avatar>
            <Typography variant="body2" color="rgb(255 255 255 / 0.7)">
              {reason === 'declined'
                ? 'Call declined'
                : reason === 'no_answer'
                  ? 'No answer'
                  : reason === 'cancelled'
                    ? 'Call cancelled'
                    : reason === 'disconnected'
                      ? 'Call disconnected'
                      : 'Call ended'}
            </Typography>
          </>
        )}

        {status !== 'ended' && status !== 'connecting' && (
          <Stack direction="row" spacing={{ xs: 1.25, sm: 2 }} alignItems="center" sx={{ mt: 2 }}>
            {status === 'active' && session.kind === 'VIDEO' && (
              <Tooltip title={videoOff ? 'Turn camera on' : 'Turn camera off'}>
                <IconButton
                  onClick={call.toggleVideo}
                  disabled={!localStream}
                  sx={{ width: 54, height: 54, color: videoOff ? '#fff' : undefined, bgcolor: videoOff ? 'error.main' : 'rgba(255,255,255,0.15)', '&:hover': { bgcolor: videoOff ? 'error.dark' : 'rgba(255,255,255,0.25)' } }}
                >
                  {videoOff ? <VideocamOffIcon /> : <VideocamIcon />}
                </IconButton>
              </Tooltip>
            )}
            {status === 'active' && (
              <Tooltip title={micMuted ? 'Unmute' : 'Mute'}>
                <IconButton
                  onClick={call.toggleMute}
                  disabled={!localStream}
                  sx={{ width: 54, height: 54, color: micMuted ? '#fff' : undefined, bgcolor: micMuted ? 'warning.main' : 'rgba(255,255,255,0.15)', '&:hover': { bgcolor: micMuted ? 'warning.dark' : 'rgba(255,255,255,0.25)' } }}
                >
                  {micMuted ? <MicOffIcon /> : <MicIcon />}
                </IconButton>
              </Tooltip>
            )}
            {status === 'active' && session.kind === 'VOICE' && (
              <Tooltip title={speakerOn ? 'Silence speaker' : 'Unmute speaker'}>
                <IconButton
                  onClick={call.toggleSpeaker}
                  sx={{ width: 54, height: 54, color: '#fff', bgcolor: 'rgba(255,255,255,0.15)', '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' } }}
                >
                  {mutedIcon}
                </IconButton>
              </Tooltip>
            )}
            {status === 'ringing' && session.mode === 'incoming' && (
              <IconButton
                aria-label="Decline call"
                onClick={call.decline}
                sx={{ width: 60, height: 60, color: '#fff', bgcolor: 'error.main', '&:hover': { bgcolor: 'error.dark' } }}
              >
                <CallEndIcon />
              </IconButton>
            )}
            {status === 'ringing' && (
              <IconButton
                aria-label={session.mode === 'outgoing' ? 'Cancel call' : 'Accept call'}
                onClick={session.mode === 'outgoing' ? call.cancel : call.accept}
                sx={{
                  width: 60,
                  height: 60,
                  color: '#fff',
                  bgcolor: session.mode === 'outgoing' ? 'rgba(255,255,255,0.18)' : 'success.main',
                  '&:hover': { bgcolor: session.mode === 'outgoing' ? 'rgba(255,255,255,0.28)' : 'success.dark' },
                }}
              >
                {session.mode === 'outgoing' ? <CallEndIcon /> : <PhoneIcon />}
              </IconButton>
            )}
            {status === 'active' && (
              <IconButton
                aria-label="End call"
                onClick={call.hangup}
                sx={{ width: 60, height: 60, color: '#fff', bgcolor: 'error.main', '&:hover': { bgcolor: 'error.dark' } }}
              >
                <CallEndIcon />
              </IconButton>
            )}
          </Stack>
        )}
      </Box>
    </Box>
  )
}