import { useState, useEffect, type ReactNode } from 'react'
import { Box, Card, CardContent, Stack, Typography, Chip } from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import SecurityIcon from '@mui/icons-material/Security'
import SpeedIcon from '@mui/icons-material/Speed'

const ROTATING_TEXTS = [
  'Automate multi-branch workforce scheduling & approvals.',
  'Hardware-ready biometric clock-in with audit verification.',
  'Encrypted team communications, memos & real-time notices.',
  'Unified executive analytics, financials & inventory tracking.',
]

const STATS = [
  { label: 'Uptime SLA', value: '99.99%', icon: SpeedIcon },
  { label: 'Enterprise Security', value: 'Role-based & Audited', icon: SecurityIcon },
]

export function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  const [activeTextIndex, setActiveTextIndex] = useState(0)
  const [fadeState, setFadeState] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setFadeState(false)
      setTimeout(() => {
        setActiveTextIndex((prev) => (prev + 1) % ROTATING_TEXTS.length)
        setFadeState(true)
      }, 400)
    }, 4200)
    return () => clearInterval(interval)
  }, [])

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', bgcolor: '#010101', color: '#FFFFFF', position: 'relative', overflow: 'hidden' }}>
      {/* Left Hero / Radiant Branding Section */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flex: '1 1 54%',
          position: 'relative',
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#050608',
          borderRight: '1px solid rgba(236, 6, 24, 0.15)',
        }}
      >
        {/* Radiant Red & Black Glowing Mesh & Radial Orbs */}
        <Box
          className="radiance-bg-orb-1"
          sx={{
            position: 'absolute',
            top: '-15%',
            left: '-10%',
            width: 600,
            height: 600,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(236, 6, 24, 0.38) 0%, rgba(184, 0, 16, 0.18) 45%, rgba(1, 1, 1, 0) 70%)',
            filter: 'blur(50px)',
            pointerEvents: 'none',
          }}
        />
        <Box
          className="radiance-bg-orb-2"
          sx={{
            position: 'absolute',
            bottom: '-20%',
            right: '-10%',
            width: 650,
            height: 650,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255, 51, 68, 0.28) 0%, rgba(133, 0, 10, 0.2) 50%, rgba(1, 1, 1, 0) 75%)',
            filter: 'blur(60px)',
            pointerEvents: 'none',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            top: '40%',
            left: '35%',
            width: 380,
            height: 380,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(236, 6, 24, 0.15) 0%, rgba(1, 1, 1, 0) 70%)',
            filter: 'blur(40px)',
            pointerEvents: 'none',
          }}
        />

        {/* Ambient Grid overlay */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px)`,
            backgroundSize: '32px 32px',
            opacity: 0.35,
            pointerEvents: 'none',
          }}
        />

        {/* Content Container */}
        <Box sx={{ position: 'relative', zIndex: 2, maxWidth: 500, px: 6, py: 6 }}>
          {/* Live Badge */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <BrandSymbol size={48} />
            <Box>
              <Typography variant="h5" fontWeight={900} sx={{ letterSpacing: '-0.02em', color: '#FFFFFF' }}>
                TGManager
              </Typography>
              <Typography variant="caption" sx={{ color: '#FF4D5E', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Enterprise Operations Platform
              </Typography>
            </Box>
          </Box>

          <Chip
            icon={<AutoAwesomeIcon sx={{ color: '#EC0618 !important', fontSize: 16 }} />}
            label="Radiant Workspace Cloud"
            size="small"
            sx={{
              mb: 3,
              bgcolor: 'rgba(236, 6, 24, 0.12)',
              color: '#FF6B7A',
              border: '1px solid rgba(236, 6, 24, 0.35)',
              fontWeight: 700,
              fontSize: '0.75rem',
            }}
          />

          {/* Animated Glowing Main Headline */}
          <Typography
            variant="h3"
            className="text-gradient-radiance"
            sx={{
              mb: 2.5,
              fontWeight: 900,
              lineHeight: 1.15,
              letterSpacing: '-0.03em',
            }}
          >
            Run your entire company in one radiant workspace.
          </Typography>

          {/* Dynamic Rotating Animated Text Banner */}
          <Box
            sx={{
              p: 2.2,
              borderRadius: 3,
              bgcolor: 'rgba(23, 25, 28, 0.75)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(236, 6, 24, 0.35)',
              boxShadow: '0 8px 32px rgba(236, 6, 24, 0.15)',
              minHeight: 82,
              display: 'flex',
              alignItems: 'center',
              transition: 'all 0.3s ease',
              mb: 4,
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                className="radiance-pulse-badge"
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  bgcolor: '#EC0618',
                  flexShrink: 0,
                }}
              />
              <Typography
                variant="body1"
                sx={{
                  fontWeight: 600,
                  color: '#F3F4F6',
                  opacity: fadeState ? 1 : 0,
                  transform: fadeState ? 'translateY(0)' : 'translateY(8px)',
                  transition: 'opacity 0.35s ease, transform 0.35s ease',
                }}
              >
                {ROTATING_TEXTS[activeTextIndex]}
              </Typography>
            </Stack>
          </Box>

          {/* Feature Highlights */}
          <Stack spacing={1.8} sx={{ mb: 4 }}>
            {[
              'Enterprise-grade multi-tenant organization boundaries',
              'Real-time attendance & live staff roster analytics',
              'Audited workflows, requisition & approval pipelines',
            ].map((f) => (
              <Stack key={f} direction="row" spacing={1.5} alignItems="center">
                <CheckCircleIcon sx={{ color: '#EC0618', fontSize: 20 }} />
                <Typography variant="body2" sx={{ color: '#D1D5DB', fontWeight: 500 }}>
                  {f}
                </Typography>
              </Stack>
            ))}
          </Stack>

          {/* Stats Bar */}
          <Stack direction="row" spacing={3} sx={{ pt: 2, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
            {STATS.map((s) => (
              <Box key={s.label}>
                <Typography variant="subtitle2" sx={{ color: '#FF4D5E', fontWeight: 800 }}>
                  {s.value}
                </Typography>
                <Typography variant="caption" sx={{ color: '#8A8F99' }}>
                  {s.label}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      </Box>

      {/* Right Form / Authentication Section */}
      <Box
        sx={{
          flex: '1 1 46%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 2.5, sm: 5 },
          bgcolor: '#010101',
          position: 'relative',
          zIndex: 3,
        }}
      >
        {/* Soft background glow on form side */}
        <Box
          sx={{
            position: 'absolute',
            top: '20%',
            right: '10%',
            width: 320,
            height: 320,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(236, 6, 24, 0.12) 0%, rgba(1, 1, 1, 0) 70%)',
            filter: 'blur(50px)',
            pointerEvents: 'none',
          }}
        />

        <Box sx={{ display: { md: 'none' }, mb: 3, textAlign: 'center' }}>
          <BrandSymbol size={56} />
        </Box>

        <Card
          sx={{
            width: '100%',
            maxWidth: 440,
            bgcolor: '#17191C',
            border: '1px solid rgba(236, 6, 24, 0.25)',
            boxShadow: '0 20px 60px -15px rgba(236, 6, 24, 0.18), 0 0 20px rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(20px)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Subtle top edge radiance bar */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: 'linear-gradient(90deg, #EC0618 0%, #FF4D5E 50%, #EC0618 100%)',
            }}
          />

          <CardContent sx={{ p: { xs: 3, sm: 4.5 } }}>
            <Typography variant="h5" fontWeight={900} sx={{ color: '#FFFFFF', letterSpacing: '-0.02em', mb: 0.5 }}>
              Welcome back
            </Typography>
            <Typography variant="body2" sx={{ color: '#8A8F99', mb: 3.5 }}>
              {title}
            </Typography>
            {children}
          </CardContent>
        </Card>

        <Typography variant="caption" sx={{ mt: 3.5, color: '#6B7280', fontWeight: 500 }}>
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
        background: 'linear-gradient(135deg, #EC0618 0%, #9B000C 100%)',
        color: '#FFFFFF',
        fontWeight: 900,
        fontSize: Math.max(18, size * 0.44),
        letterSpacing: '-0.02em',
        boxShadow: '0 8px 24px -4px rgba(236, 6, 24, 0.65), 0 0 12px rgba(236, 6, 24, 0.4)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        flexShrink: 0,
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          transform: 'scale(1.05)',
          boxShadow: '0 12px 30px -4px rgba(236, 6, 24, 0.8)',
        },
      }}
    >
      TG
    </Box>
  )
}
