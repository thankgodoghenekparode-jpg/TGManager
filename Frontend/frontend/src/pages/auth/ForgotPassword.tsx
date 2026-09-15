import { useState, type FormEvent } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { Alert, Button, CircularProgress, Link, Stack, TextField, Typography } from '@mui/material'
import { authApi } from '../../api/auth'
import { apiErrorMessage } from '../../api/client'
import { AuthShell } from './AuthShell'

export function ForgotPasswordPage() {
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
      const res = await authApi.forgotPassword(email)
      setMessage(res.message)
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell title="Reset your password">
      {message ? (
        <Stack spacing={2}>
          <Typography variant="body1">{message}</Typography>
          <Button variant="contained" onClick={() => navigate('/login')}>
            Back to sign in
          </Button>
        </Stack>
      ) : (
        <form onSubmit={onSubmit}>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
            <Button type="submit" variant="contained" size="large" disabled={submitting} fullWidth>
              {submitting ? <CircularProgress size={22} color="inherit" /> : 'Send reset link'}
            </Button>
            <Link component={RouterLink} to="/login" variant="body2" align="center">Back to sign in</Link>
            <Link component={RouterLink} to="/password-reset-request" variant="body2" align="center" color="text.secondary">
              No email access? Request an admin reset
            </Link>
          </Stack>
        </form>
      )}
    </AuthShell>
  )
}
