import type { ReactNode } from 'react'
import { Box, Card, CardContent, Stack, Typography } from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'

const GRADIENT = 'linear-gradient(160deg, #2563eb 0%, #111827 100%)'

const FEATURES = [
  'Manage teams, schedules and attendance in one place',
  'Automate approvals with configurable workflows',
  'Stay in sync with chat, memos and shared documents',
]

export function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', bgcolor: 'background.default' }}>
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flex: '1 1 52%',
          backgroundImage: GRADIENT,
          color: '#fff',
          position: 'relative',
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Box sx={{ opacity: 0.28 }}>
          <Circle size={460} top="-12%" right="-14%" />
          <Circle size={360} bottom="-10%" left="-10%" />
          <Circle size={220} top="18%" left="12%" />
        </Box>
        <Box sx={{ position: 'relative', zIndex: 1, maxWidth: 420, px: 6, py: 6 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 4 }}>
            <BrandSymbol size={46} />
            <Box>
              <Typography variant="h5" fontWeight={800} lineHeight={1}>Zarox Connect</Typography>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>Workforce & operations, together</Typography>
            </Box>
          </Box>
          <Typography variant="h3" sx={{ mb: 2, lineHeight: 1.15, maxWidth: 430 }}>
            Run your entire company in one connected workspace.
          </Typography>
          <Stack spacing={1.5} sx={{ mt: 4 }}>
            {FEATURES.map((f) => (
              <Stack key={f} direction="row" spacing={1.5} alignItems="flex-start">
                <CheckCircleIcon fontSize="small" sx={{ mt: 0.25 }} />
                <Typography variant="body2" sx={{ opacity: 0.92 }}>{f}</Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
      </Box>

      <Box
        sx={{
          flex: '1 1 48%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 2, sm: 4 },
        }}
      >
        <Box sx={{ display: { md: 'none' }, mb: 3, textAlign: 'center' }}>
          <Box component="img" src="/zarox-connect-logo.jpeg" alt="Zarox Connect" sx={{ width: 190, height: 150, objectFit: 'contain', display: 'block', mixBlendMode: 'multiply' }} />
        </Box>
        <Card sx={{ width: '100%', maxWidth: 440, boxShadow: '0 18px 50px -20px rgba(15, 23, 42, 0.25)' }}>
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            <Typography variant="h5" fontWeight={800} gutterBottom>
              Welcome back
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              {title}
            </Typography>
            {children}
          </CardContent>
        </Card>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 3 }}>
          Zarox Connect · Secure access for your organisation
        </Typography>
      </Box>
    </Box>
  )
}

function BrandSymbol({ size }: { size: number }) {
  return (
    <Box
      component="img"
      src="/zarox-connect-logo.jpeg"
      alt=""
      sx={{
        width: size * 1.6,
        height: size * 1.6,
        objectFit: 'contain',
        display: 'block',
        borderRadius: 2,
        bgcolor: '#fff',
        p: 0.4,
        boxShadow: '0 8px 18px -8px rgba(0, 0, 0, 0.35)',
        flexShrink: 0,
      }}
    />
  )
}

function Circle({ size, top, bottom, left, right }: { size: number; top?: string; bottom?: string; left?: string; right?: string }) {
  return (
    <Box
      sx={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: '50%',
        top,
        bottom,
        left,
        right,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        border: '1px solid rgba(255, 255, 255, 0.18)',
      }}
    />
  )
}
