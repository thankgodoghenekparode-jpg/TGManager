import { useState, type FormEvent } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { Alert, Button, CircularProgress, Link, Stack, TextField, Typography } from '@mui/material'
import { authApi } from '../../api/auth'
import { apiErrorMessage } from '../../api/client'
import { notifySuperAdmin, superAdminParams } from '../../lib/emailjs'
import { AuthShell } from './AuthShell'

export function PasswordResetRequestPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await authApi.passwordResetRequest(email)
      setMessage(res.message)
      // Best-effort admin notification via EmailJS. DB is source of truth.
      void notifySuperAdmin({
        template: 'passwordReset',
        params: superAdminParams({
          email,
          customer_name: '',
          customer_id: '',
        }),
      })
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell title="Forgot Password">
      {message ? (
        <Stack spacing={2}>
          <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>{message}</Typography>
          <Button variant="contained" onClick={() => navigate('/login')}>Back to sign in</Button>
        </Stack>
      ) : (
        <form onSubmit={onSubmit}>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Enter your registered email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
            />
            <Button type="submit" variant="contained" size="large" disabled={submitting} fullWidth>
              {submitting ? <CircularProgress size={22} color="inherit" /> : 'Submit Request'}
            </Button>
            <Link component={RouterLink} to="/login" variant="body2" align="center">Back to sign in</Link>
          </Stack>
        </form>
      )}
    </AuthShell>
  )
}
