import type { ReactNode } from 'react'
import { Box, Card, CardContent, Stack, Typography } from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import SecurityIcon from '@mui/icons-material/Security'
import SpeedIcon from '@mui/icons-material/Speed'
import FingerprintIcon from '@mui/icons-material/Fingerprint'
import HubIcon from '@mui/icons-material/Hub'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'

const STATS = [
  { label: 'Uptime SLA', value: '99.99%', icon: SpeedIcon },
  { label: 'Security Standard', value: 'AES-256 Audited', icon: SecurityIcon },
  { label: 'Multi-Tenant Nodes', value: 'Instant Sync', icon: HubIcon },
]

export function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        bgcolor: '#010101',
        color: '#FFFFFF',
        position: 'relative',
        overflow: 'hidden',
        background: 'radial-gradient(circle at 10% 20%, #150204 0%, #010101 55%, #080102 100%)',
      }}
    >
      {/* ─── FULL-SCREEN SEAMLESS RED & BLACK RADIANCE AMBIENT GLOWS ─── */}
      <Box
        className="radiance-bg-orb-1"
        sx={{
          position: 'absolute',
          top: '-15%',
          left: '-5%',
          width: 700,
          height: 700,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(236, 6, 24, 0.45) 0%, rgba(184, 0, 16, 0.22) 40%, rgba(1, 1, 1, 0) 70%)',
          filter: 'blur(70px)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />
      <Box
        className="radiance-bg-orb-2"
        sx={{
          position: 'absolute',
          bottom: '-20%',
          right: '-5%',
          width: 800,
          height: 800,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255, 51, 68, 0.35) 0%, rgba(133, 0, 10, 0.25) 45%, rgba(1, 1, 1, 0) 75%)',
          filter: 'blur(80px)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          top: '35%',
          right: '30%',
          width: 550,
          height: 550,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(236, 6, 24, 0.22) 0%, rgba(1, 1, 1, 0) 70%)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* Futuristic Cyber Radiance Grid Overlay across the ENTIRE screen */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(to right, rgba(236, 6, 24, 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(236, 6, 24, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
          opacity: 0.6,
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* Subtle Radiant Scanline Beam */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '2px',
          background: 'linear-gradient(90deg, transparent 0%, rgba(236, 6, 24, 0.8) 50%, transparent 100%)',
          boxShadow: '0 0 20px 2px #EC0618',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />

      {/* ─── LEFT HERO / COVER PHOTO SECTION ─── */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flex: '1 1 54%',
          position: 'relative',
          zIndex: 2,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          p: { md: 5, lg: 7 },
        }}
      >
        {/* Orbital Futuristic Cyber Rings Background */}
        <Box
          className="radiance-orbit-slow"
          sx={{
            position: 'absolute',
            width: 580,
            height: 580,
            borderRadius: '50%',
            border: '1px dashed rgba(236, 6, 24, 0.25)',
            pointerEvents: 'none',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            width: 440,
            height: 440,
            borderRadius: '50%',
            border: '1px solid rgba(236, 6, 24, 0.15)',
            boxShadow: 'inset 0 0 40px rgba(236, 6, 24, 0.08)',
            pointerEvents: 'none',
          }}
        />

        {/* Floating Fine-Design Glass Widgets */}
        <Box
          className="radiance-float-1"
          sx={{
            position: 'absolute',
            top: '12%',
            right: '8%',
            p: 1.8,
            borderRadius: 3,
            bgcolor: 'rgba(23, 25, 28, 0.75)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(236, 6, 24, 0.35)',
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.6), 0 0 15px rgba(236, 6, 24, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            zIndex: 3,
          }}
        >
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 2,
              bgcolor: 'rgba(16, 185, 129, 0.15)',
              color: '#10B981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <TrendingUpIcon fontSize="small" />
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: '#9CA3AF', display: 'block', fontWeight: 600 }}>
              Live Staff Presence
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#10B981', boxShadow: '0 0 8px #10B981' }} />
              <Typography variant="body2" fontWeight={800} color="#FFFFFF">
                98.8% On Schedule
              </Typography>
            </Stack>
          </Box>
        </Box>

        <Box
          className="radiance-float-2"
          sx={{
            position: 'absolute',
            bottom: '10%',
            left: '8%',
            p: 1.8,
            borderRadius: 3,
            bgcolor: 'rgba(23, 25, 28, 0.75)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(236, 6, 24, 0.35)',
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.6), 0 0 15px rgba(236, 6, 24, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            zIndex: 3,
          }}
        >
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 2,
              bgcolor: 'rgba(236, 6, 24, 0.18)',
              color: '#EC0618',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FingerprintIcon fontSize="small" />
          </Box>
          <Box>
            <Typography variant="subtitle2" fontWeight={800} color="#FFFFFF">
              Biometric Clock-In
            </Typography>
          </Box>
        </Box>

        {/* Content Container */}
        <Box sx={{ position: 'relative', zIndex: 2, maxWidth: 510, width: '100%' }}>
          {/* Logo & Platform Tag */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <BrandSymbol size={50} />
            <Box>
              <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: '-0.02em', color: '#FFFFFF', lineHeight: 1.1 }}>
                TGManager
              </Typography>
              <Typography variant="caption" sx={{ color: '#FF4D5E', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Enterprise Operations Platform
              </Typography>
            </Box>
          </Box>

          {/* Animated Glowing Main Headline */}
          <Typography
            variant="h3"
            className="text-gradient-radiance"
            sx={{
              mb: 3.5,
              fontWeight: 900,
              lineHeight: 1.15,
              letterSpacing: '-0.03em',
            }}
          >
            Run your entire company in one radiant workspace.
          </Typography>

          {/* Feature Highlights with Red Glowing Badges */}
          <Stack spacing={2} sx={{ mb: 4.5 }}>
            {[
              'Enterprise multi-tenant organization boundaries & security',
              'Real-time attendance & live staff roster analytics',
              'Audited workflows, requisition & multi-tier approval pipelines',
            ].map((f) => (
              <Stack key={f} direction="row" spacing={1.5} alignItems="center">
                <CheckCircleIcon sx={{ color: '#EC0618', fontSize: 20 }} />
                <Typography variant="body2" sx={{ color: '#E5E7EB', fontWeight: 500 }}>
                  {f}
                </Typography>
              </Stack>
            ))}
          </Stack>

          {/* Stats Bar */}
          <Stack direction="row" spacing={3} sx={{ pt: 2.5, borderTop: '1px solid rgba(236, 6, 24, 0.2)' }}>
            {STATS.map((s) => (
              <Box key={s.label}>
                <Typography variant="subtitle2" sx={{ color: '#FF4D5E', fontWeight: 800 }}>
                  {s.value}
                </Typography>
                <Typography variant="caption" sx={{ color: '#9CA3AF' }}>
                  {s.label}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      </Box>

      {/* ─── RIGHT LOGIN / PASSWORD FORM SECTION (SAME RADIANCE WORLD) ─── */}
      <Box
        sx={{
          flex: '1 1 46%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 2.5, sm: 5 },
          position: 'relative',
          zIndex: 2,
        }}
      >
        {/* Dedicated Backlight Behind Login/Password Card */}
        <Box
          sx={{
            position: 'absolute',
            width: 460,
            height: 460,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(236, 6, 24, 0.28) 0%, rgba(184, 0, 16, 0.12) 50%, transparent 70%)',
            filter: 'blur(50px)',
            pointerEvents: 'none',
            zIndex: -1,
          }}
        />

        {/* Mobile Header */}
        <Box sx={{ display: { md: 'none' }, mb: 3, textAlign: 'center' }}>
          <BrandSymbol size={56} />
          <Typography variant="h5" fontWeight={900} sx={{ mt: 1.5, color: '#FFFFFF' }}>
            TGManager
          </Typography>
          <Typography variant="caption" sx={{ color: '#FF4D5E', fontWeight: 700 }}>
            Enterprise Workspace
          </Typography>
        </Box>

        {/* Frosted Glass Radiant Password/Auth Card */}
        <Card
          className="auth-radiant-card"
          sx={{
            width: '100%',
            maxWidth: 450,
            borderRadius: 4,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Radiant Shimmer Bar at the top of Card */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: 'linear-gradient(90deg, #EC0618 0%, #FF6B7A 50%, #EC0618 100%)',
              boxShadow: '0 0 12px #EC0618',
            }}
          />

          <CardContent sx={{ p: { xs: 3, sm: 4.5 } }}>
            {/* Header Badge */}
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: 1.5,
                  bgcolor: 'rgba(236, 6, 24, 0.18)',
                  color: '#EC0618',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <LockOutlinedIcon sx={{ fontSize: 16 }} />
              </Box>
              <Typography variant="caption" sx={{ color: '#FF6B7A', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Secure Access Gateway
              </Typography>
            </Stack>

            <Typography variant="h5" fontWeight={900} sx={{ color: '#FFFFFF', letterSpacing: '-0.02em', mb: 0.5 }}>
              Welcome back
            </Typography>
            <Typography variant="body2" sx={{ color: '#9CA3AF', mb: 3.5 }}>
              {title}
            </Typography>

            {children}
          </CardContent>
        </Card>

        <Typography variant="caption" sx={{ mt: 3.5, color: '#9CA3AF', fontWeight: 600, letterSpacing: '0.02em' }}>
          TGManager • Secure Enterprise Workspace
        </Typography>
      </Box>
    </Box>
  )
}

function BrandSymbol({ size }: { size: number }) {
  return (
    <Box
      aria-hidden="true"
      sx={{
        width: size * 1.25,
        height: size * 1.25,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 3,
        background: 'linear-gradient(135deg, #EC0618 0%, #88000A 100%)',
        color: '#FFFFFF',
        fontWeight: 900,
        fontSize: Math.max(18, size * 0.44),
        letterSpacing: '-0.02em',
        boxShadow: '0 8px 24px -4px rgba(236, 6, 24, 0.75), 0 0 16px rgba(236, 6, 24, 0.45)',
        border: '1px solid rgba(255, 255, 255, 0.25)',
        flexShrink: 0,
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          transform: 'scale(1.05)',
          boxShadow: '0 12px 32px -4px rgba(236, 6, 24, 0.9), 0 0 20px rgba(236, 6, 24, 0.6)',
        },
      }}
    >
      TG
    </Box>
  )
}
