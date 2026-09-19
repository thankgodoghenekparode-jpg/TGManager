import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material'
import BusinessIcon from '@mui/icons-material/Business'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { useAuthStore } from '../store/auth'
import { useTenantStore } from '../store/tenant'
import { setTenantId } from '../api/client'
import { ThemeToggle } from '../components/ThemeToggle'
import { useColorMode } from '../contexts/ThemeContext'

export function SelectCompanyPage() {
  const navigate = useNavigate()
  const memberships = useAuthStore((s) => s.memberships)
  const loadTenant = useTenantStore((s) => s.load)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const { mode } = useColorMode()
  const isDark = mode === 'dark'

  useEffect(() => {
    if (memberships.length === 1) {
      void enter(memberships[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberships])

  async function enter(tenantId: string) {
    setLoading(tenantId)
    setError('')
    setTenantId(tenantId)
    try {
      await loadTenant()
      navigate(`/app`, { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to open company')
    } finally {
      setLoading(null)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        color: 'text.primary',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        p: { xs: 2.5, sm: 4 },
        position: 'relative',
        overflow: 'hidden',
        background: isDark
          ? 'radial-gradient(circle at 50% 20%, #150204 0%, #010101 70%)'
          : 'radial-gradient(circle at 50% 10%, #FFF0F2 0%, #F8FAFC 75%)',
        transition: 'background 0.3s ease',
      }}
    >
      <Box sx={{ position: 'absolute', top: 20, right: 20, zIndex: 10 }}>
        <ThemeToggle />
      </Box>

      <Box
        className="radiance-bg-orb-1"
        sx={{
          position: 'absolute',
          top: '-10%',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: isDark
            ? 'radial-gradient(circle, rgba(236, 6, 24, 0.3) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(236, 6, 24, 0.15) 0%, transparent 70%)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
      />

      <Box sx={{ width: '100%', maxWidth: 480, position: 'relative', zIndex: 2 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box
            sx={{
              width: 54,
              height: 54,
              mx: 'auto',
              mb: 2,
              borderRadius: 3,
              background: 'linear-gradient(135deg, #EC0618 0%, #88000A 100%)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: 22,
              boxShadow: '0 8px 24px -4px rgba(236, 6, 24, 0.75)',
            }}
          >
            TG
          </Box>
          <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: '-0.02em', mb: 0.5 }}>
            Choose Workspace
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Select the organization you wish to manage today
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2.5, bgcolor: 'rgba(236, 6, 24, 0.12)', border: '1px solid rgba(236, 6, 24, 0.4)' }}>
            {error}
          </Alert>
        )}

        <Stack spacing={2}>
          {memberships.map((m) => (
            <Card
              key={m.id}
              className="auth-radiant-card"
              sx={{
                borderRadius: 3,
                transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  borderColor: '#EC0618 !important',
                },
              }}
            >
              <CardActionArea onClick={() => enter(m.id)} disabled={loading !== null} sx={{ p: 1 }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 2.5,
                          bgcolor: 'rgba(236, 6, 24, 0.15)',
                          color: '#EC0618',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <BusinessIcon fontSize="small" />
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle1" fontWeight={800} noWrap>
                          {m.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap display="block">
                          {m.plan?.name ?? 'Standard Plan'} · <span style={{ color: '#10B981', fontWeight: 700 }}>{m.status}</span>
                        </Typography>
                      </Box>
                    </Stack>
                    {loading === m.id ? (
                      <CircularProgress size={22} color="error" />
                    ) : (
                      <Button
                        variant="contained"
                        size="small"
                        endIcon={<ArrowForwardIcon />}
                        sx={{ flexShrink: 0, px: 2 }}
                      >
                        Open
                      </Button>
                    )}
                  </Stack>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}

          {memberships.length === 0 && (
            <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
              You are not a member of any company workspace yet.
            </Typography>
          )}
        </Stack>
      </Box>
    </Box>
  )
}
