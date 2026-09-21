import { useEffect, useState } from 'react'
import { Box, Button, IconButton, Paper, Stack, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import DownloadForOfflineIcon from '@mui/icons-material/DownloadForOffline'
import IosShareIcon from '@mui/icons-material/IosShare'
import AddBoxOutlinedIcon from '@mui/icons-material/AddBoxOutlined'
import { Logo } from './brand/Logo'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isIosSafari(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  const ua = window.navigator.userAgent.toLowerCase()
  const isIos = /iphone|ipad|ipod/.test(ua)
  const isWebkit = /webkit/.test(ua)
  const isOtherBrowser = /crios|fxios|optios|edgios/.test(ua)
  return isIos && isWebkit && !isOtherBrowser
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIosPrompt, setIsIosPrompt] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Check if already in standalone mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true

    if (isStandalone) return

    // Check if dismissed in this session
    if (sessionStorage.getItem('pwa_install_dismissed')) return

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    // Check for iOS Safari (which doesn't support beforeinstallprompt)
    if (isIosSafari()) {
      setIsIosPrompt(true)
      // Slight delay so it doesn't immediately distract the user on first load
      const timer = setTimeout(() => {
        setVisible(true)
      }, 2000)
      return () => {
        clearTimeout(timer)
        window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      }
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setVisible(false)
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setVisible(false)
    sessionStorage.setItem('pwa_install_dismissed', 'true')
  }

  if (!visible || (!deferredPrompt && !isIosPrompt)) return null

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        bottom: { xs: 'calc(16px + env(safe-area-inset-bottom, 0px))', sm: 24 },
        right: { xs: 'calc(16px + env(safe-area-inset-right, 0px))', sm: 24 },
        left: { xs: 'calc(16px + env(safe-area-inset-left, 0px))', sm: 'auto' },
        maxWidth: 420,
        zIndex: 1300,
        p: 2,
        borderRadius: 3.5,
        border: '1px solid',
        borderColor: 'primary.main',
        boxShadow: '0 12px 36px rgba(236, 6, 24, 0.25), 0 4px 16px rgba(0, 0, 0, 0.4)',
        animation: 'app-page-enter 0.3s cubic-bezier(0.16, 1, 0.3, 1) both',
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Logo variant="mark" size={36} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" fontWeight={800} noWrap>
            Install TGManager App
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            Fast access, full screen & offline capabilities
          </Typography>
        </Box>
        <IconButton size="small" onClick={handleDismiss} aria-label="Dismiss">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>

      {isIosPrompt && !deferredPrompt ? (
        <Box sx={{ mt: 1.5, p: 1.25, borderRadius: 2, bgcolor: 'action.hover', border: '1px dashed rgba(236, 6, 24, 0.3)' }}>
          <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', fontWeight: 600 }}>
            Tap <IosShareIcon sx={{ fontSize: 16, color: 'primary.main' }} /> <strong>Share</strong> then select <AddBoxOutlinedIcon sx={{ fontSize: 16, color: 'primary.main' }} /> <strong>Add to Home Screen</strong>
          </Typography>
        </Box>
      ) : null}

      <Stack direction="row" spacing={1} sx={{ mt: 1.5, justifyContent: 'flex-end' }}>
        <Button size="small" onClick={handleDismiss} sx={{ color: 'text.secondary', fontWeight: 600 }}>
          {isIosPrompt && !deferredPrompt ? 'Got it' : 'Not now'}
        </Button>
        {deferredPrompt ? (
          <Button
            size="small"
            variant="contained"
            startIcon={<DownloadForOfflineIcon />}
            onClick={handleInstall}
            sx={{ fontWeight: 800, borderRadius: 2 }}
          >
            Install
          </Button>
        ) : null}
      </Stack>
    </Paper>
  )
}
