import { useState, type FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Alert,
  Button,
  CircularProgress,
  Link,
  Stack,
  TextField,
} from '@mui/material'
import { useAuthStore } from '../../store/auth'
import { apiErrorMessage, getTenantId } from '../../api/client'
import { isPlatformAdmin } from '../../store/tenant'
import { useTenantStore } from '../../store/tenant'
import { AuthShell } from './AuthShell'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const login = useAuthStore((s) => s.login)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const loadTenant = useTenantStore((s) => s.load)

  const from = (location.state as { from?: string } | null)?.from

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email, password)
      const user = useAuthStore.getState().user
      if (!user) throw new Error('Login failed')
      const isPlatform = isPlatformAdmin(user.role)
      const target = from ?? (isPlatform ? '/admin' : getTenantId() ? '/app' : '/select-company')
      if (target.startsWith('/app')) {
        await loadTenant()
      }
      navigate(target, { replace: true })
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell title="Sign in to Zarox Connect">
      <form onSubmit={onSubmit}>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
          />
          <Button type="submit" variant="contained" size="large" disabled={submitting} fullWidth>
            {submitting ? <CircularProgress size={22} color="inherit" /> : 'Sign in'}
          </Button>
          <Stack direction="row" justifyContent={{ xs: 'center', sm: 'flex-end' }}>
            <Link href="/forgot-password" variant="body2">Forgot password?</Link>
          </Stack>
          <Stack direction="row" justifyContent="center" sx={{ textAlign: 'center' }}>
            <Link href="/password-reset-request" variant="body2" color="text.secondary">
              Request an admin password reset
            </Link>
          </Stack>
        </Stack>
      </form>
    </AuthShell>
  )
}
