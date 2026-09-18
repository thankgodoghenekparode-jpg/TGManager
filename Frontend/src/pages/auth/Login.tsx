import { useState, type FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Alert,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Link,
  Stack,
  TextField,
} from '@mui/material'
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
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
  const [showPassword, setShowPassword] = useState(false)
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
    <AuthShell title="Sign in to your organization workspace">
      <form onSubmit={onSubmit}>
        <Stack spacing={2.5}>
          {error && (
            <Alert
              severity="error"
              sx={{
                bgcolor: 'rgba(236, 6, 24, 0.12)',
                color: '#FF6B7A',
                border: '1px solid rgba(236, 6, 24, 0.4)',
                borderRadius: 2.5,
              }}
            >
              {error}
            </Alert>
          )}

          <TextField
            label="Corporate Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <EmailOutlinedIcon sx={{ color: '#8A8F99', fontSize: 20 }} />
                </InputAdornment>
              ),
            }}
          />

          <TextField
            label="Password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockOutlinedIcon sx={{ color: '#8A8F99', fontSize: 20 }} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={() => setShowPassword((prev) => !prev)}
                    edge="end"
                    size="small"
                    sx={{ color: '#8A8F99' }}
                  >
                    {showPassword ? <VisibilityOffOutlinedIcon fontSize="small" /> : <VisibilityOutlinedIcon fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={submitting}
            fullWidth
            endIcon={!submitting && <ArrowForwardIcon />}
            sx={{
              py: 1.5,
              fontWeight: 800,
              fontSize: '1rem',
              letterSpacing: '0.01em',
            }}
          >
            {submitting ? <CircularProgress size={22} color="inherit" /> : 'Enter Workspace'}
          </Button>

          <Stack direction="row" justifyContent={{ xs: 'center', sm: 'flex-end' }}>
            <Link href="/forgot-password" variant="body2" sx={{ color: '#FF4D5E', fontWeight: 600 }}>
              Forgot password?
            </Link>
          </Stack>

          <Stack direction="row" justifyContent="center" sx={{ textAlign: 'center', pt: 1 }}>
            <Link href="/password-reset-request" variant="body2" sx={{ color: '#9CA3AF', '&:hover': { color: '#FFFFFF' } }}>
              Request an admin password reset
            </Link>
          </Stack>
        </Stack>
      </form>
    </AuthShell>
  )
}
