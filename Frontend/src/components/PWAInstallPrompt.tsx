import { useEffect, useState } from 'react'
import { Box, Button, IconButton, Paper, Stack, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import DownloadForOfflineIcon from '@mui/icons-material/DownloadForOffline'
import { Logo } from './brand/Logo'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
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

  if (!visible || !deferredPrompt) return null

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        bottom: { xs: 16, sm: 24 },
        right: { xs: 16, sm: 24 },
        left: { xs: 16, sm: 'auto' },
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

      <Stack direction="row" spacing={1} sx={{ mt: 1.5, justifyContent: 'flex-end' }}>
        <Button size="small" onClick={handleDismiss} sx={{ color: 'text.secondary', fontWeight: 600 }}>
          Not now
        </Button>
        <Button
          size="small"
          variant="contained"
          startIcon={<DownloadForOfflineIcon />}
          onClick={handleInstall}
          sx={{ fontWeight: 800, borderRadius: 2 }}
        >
          Install
        </Button>
      </Stack>
    </Paper>
  )
}
