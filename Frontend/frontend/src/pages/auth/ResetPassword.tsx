import { useState, type FormEvent } from 'react'
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, Button, CircularProgress, Link, Stack, TextField } from '@mui/material'
import { authApi } from '../../api/auth'
import { apiErrorMessage } from '../../api/client'
import { AuthShell } from './AuthShell'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    const token = params.get('token')
    if (!token) {
      setError('Missing reset token')
      return
    }
    setSubmitting(true)
    try {
      await authApi.resetPassword(token, password)
      setDone(true)
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell title="Choose a new password">
      {done ? (
        <Stack spacing={2}>
          <Alert severity="success">Your password has been reset.</Alert>
          <Button variant="contained" onClick={() => navigate('/login')}>Sign in</Button>
        </Stack>
      ) : (
        <form onSubmit={onSubmit}>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="New password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} fullWidth />
            <TextField label="Confirm password" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} fullWidth />
            <Button type="submit" variant="contained" size="large" disabled={submitting} fullWidth>
              {submitting ? <CircularProgress size={22} color="inherit" /> : 'Reset password'}
            </Button>
            <Link component={RouterLink} to="/login" variant="body2" align="center">Back to sign in</Link>
          </Stack>
        </form>
      )}
    </AuthShell>
  )
}
