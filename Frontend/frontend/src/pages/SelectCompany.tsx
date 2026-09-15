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
import { useAuthStore } from '../store/auth'
import { useTenantStore } from '../store/tenant'
import { setTenantId } from '../api/client'

export function SelectCompanyPage() {
  const navigate = useNavigate()
  const memberships = useAuthStore((s) => s.memberships)
  const loadTenant = useTenantStore((s) => s.load)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

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
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: { xs: 2, sm: 4 } }}>
      <Typography variant="h5" fontWeight={700} align="center" sx={{ mb: 4 }}>
        Choose a company
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2, maxWidth: 480, mx: 'auto' }}>{error}</Alert>}
      <Stack spacing={2} sx={{ maxWidth: 480, mx: 'auto' }}>
        {memberships.map((m) => (
          <Card key={m.id} variant="outlined">
            <CardActionArea onClick={() => enter(m.id)} disabled={loading !== null}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h6">{m.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {m.plan?.name ?? 'No plan'} · {m.status}
                    </Typography>
                  </Box>
                  {loading === m.id ? <CircularProgress size={22} /> : <Button>Open</Button>}
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
        {memberships.length === 0 && (
          <Typography color="text.secondary" align="center">
            You are not a member of any company yet.
          </Typography>
        )}
      </Stack>
    </Box>
  )
}
