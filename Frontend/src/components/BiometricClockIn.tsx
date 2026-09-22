import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import FingerprintIcon from '@mui/icons-material/Fingerprint'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'

type VerifyMethod = 'webauthn' | 'photo'

export interface BiometricVerification {
  method: VerifyMethod
  capturedAt: string
  photoDataUrl?: string
}

const PASSKEY_STORE_KEY = 'tgmanager-passkeys'
const UV_FLAG_BIT = 4

function loadPasskeyIds(): string[] {
  try {
    const raw = window.localStorage.getItem(PASSKEY_STORE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === 'string')
      : []
  } catch {
    return []
  }
}

function savePasskeyId(id: string): void {
  const ids = loadPasskeyIds()
  if (!ids.includes(id)) {
    ids.push(id)
    window.localStorage.setItem(PASSKEY_STORE_KEY, JSON.stringify(ids))
  }
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = window.atob(padded)
  const buffer = new ArrayBuffer(raw.length)
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

export function BiometricClockIn({
  onVerified,
  disabled,
}: {
  onVerified: (verification: BiometricVerification) => void
  disabled?: boolean
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [busy, setBusy] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [verified, setVerified] = useState<VerifyMethod | null>(null)
  const [error, setError] = useState('')
  const [hasSaved, setHasSaved] = useState(loadPasskeyIds().length > 0)

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setCameraActive(false)
  }

  useEffect(() => {
    return () => stopCamera()
  }, [])

  const completeFingerprint = (credential: PublicKeyCredential) => {
    const response = credential.response as AuthenticatorAssertionResponse
    const authData = new Uint8Array(response.authenticatorData as ArrayBuffer)
    if ((authData[32] & UV_FLAG_BIT) === 0) {
      setError('The fingerprint sensor did not verify your identity. Try again.')
      return
    }
    setVerified('webauthn')
    onVerified({ method: 'webauthn', capturedAt: new Date().toISOString() })
  }

  const registerFingerprint = async () => {
    setError('')
    if (!window.PublicKeyCredential || !navigator.credentials) {
      setError('Fingerprint registration is not available in this browser. Use camera verification instead.')
      return
    }
    setBusy(true)
    try {
      const challenge = new Uint8Array(32)
      window.crypto.getRandomValues(challenge)
      const userId = new Uint8Array(16)
      window.crypto.getRandomValues(userId)
      const credential = (await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'TGManager' },
          user: {
            id: userId,
            name: 'staff-fingerprint',
            displayName: 'Staff fingerprint',
          },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },
            { type: 'public-key', alg: -257 },
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            residentKey: 'required',
            userVerification: 'required',
          },
          timeout: 60000,
          attestation: 'none',
        },
      })) as PublicKeyCredential
      savePasskeyId(credential.id)
      setHasSaved(true)
      completeFingerprint(credential)
    } catch {
      setError('Fingerprint registration was cancelled or unavailable. You can verify with the camera.')
    } finally {
      setBusy(false)
    }
  }

  const verifyWithFingerprint = async () => {
    setError('')
    if (!window.PublicKeyCredential || !navigator.credentials) {
      setError('Fingerprint verification is not available in this browser. Use camera verification instead.')
      return
    }

    const savedIds = loadPasskeyIds()
    if (savedIds.length === 0) {
      await registerFingerprint()
      return
    }

    setBusy(true)
    try {
      const challenge = new Uint8Array(32)
      window.crypto.getRandomValues(challenge)
      const credential = (await navigator.credentials.get({
        publicKey: {
          challenge,
          timeout: 60000,
          userVerification: 'required',
          allowCredentials: savedIds.map((id) => ({
            type: 'public-key',
            id: base64UrlToBytes(id),
            transports: ['internal'],
          })),
        },
      })) as PublicKeyCredential
      completeFingerprint(credential)
    } catch {
      setError(
        'No fingerprint on this device matches the saved one. Verify with the camera, or tap “Re-save fingerprint” to enroll this device.',
      )
    } finally {
      setBusy(false)
    }
  }

  const startCamera = async () => {
    setError('')
    setBusy(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraActive(true)
    } catch {
      setError('Camera access was denied or unavailable.')
    } finally {
      setBusy(false)
    }
  }

  const capturePhoto = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const context = canvas.getContext('2d')
    if (!context) return

    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const photoDataUrl = canvas.toDataURL('image/jpeg', 0.72)
    stopCamera()
    setVerified('photo')
    onVerified({ method: 'photo', capturedAt: new Date().toISOString(), photoDataUrl })
  }

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
        <Box>
          <Typography variant="subtitle2" fontWeight={800}>
            Identity check
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Use fingerprint verification or capture a quick camera check.
          </Typography>
        </Box>
        {verified && <CheckCircleIcon color="success" />}
      </Stack>

      {error && <Alert severity="warning">{error}</Alert>}
      {verified && (
        <Alert severity="success">
          {verified === 'webauthn' ? 'Fingerprint verified.' : 'Camera verification captured.'}
        </Alert>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <Button
          variant="outlined"
          startIcon={<FingerprintIcon />}
          onClick={() => void verifyWithFingerprint()}
          disabled={disabled || busy}
        >
          {hasSaved ? 'Verify fingerprint' : 'Save fingerprint'}
        </Button>
        {hasSaved && (
          <Button
            size="small"
            color="info"
            onClick={() => void registerFingerprint()}
            disabled={disabled || busy}
            sx={{ alignSelf: 'center' }}
          >
            Re-save fingerprint
          </Button>
        )}
        <Button
          variant="outlined"
          startIcon={<PhotoCameraIcon />}
          onClick={() => void startCamera()}
          disabled={disabled || busy || cameraActive}
        >
          Use camera
        </Button>
      </Stack>

      {busy && <CircularProgress size={20} />}

      <Box sx={{ display: cameraActive ? 'block' : 'none' }}>
        <Box
          component="video"
          ref={videoRef}
          muted
          playsInline
          sx={{
            width: '100%',
            maxHeight: 220,
            borderRadius: 2,
            backgroundColor: 'grey.100',
            objectFit: 'cover',
          }}
        />
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          <Button variant="contained" onClick={capturePhoto} disabled={disabled || busy}>
            Capture
          </Button>
          <Button onClick={stopCamera} disabled={disabled || busy}>
            Cancel camera
          </Button>
        </Stack>
      </Box>

      <canvas ref={canvasRef} hidden />
    </Stack>
  )
}
