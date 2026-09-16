import { useState, type FormEvent } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import { accountApi } from '../../api/account'
import { apiErrorMessage } from '../../api/client'
import { useAuthStore } from '../../store/auth'
import { notifySuperAdmin, superAdminParams } from '../../lib/emailjs'

export function ChangeEmailPage() {
  const user = useAuthStore((s) => s.user)
  const [requestedEmail, setRequestedEmail] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)
    try {
      const res = await accountApi.createEmailChange({
        requestedEmail,
        reason: reason.trim() || undefined,
      })
      setSuccess(res.message)
      setRequestedEmail('')
      setReason('')
      // Best-effort admin notification via EmailJS. DB is source of truth.
      void notifySuperAdmin({
        template: 'emailChange',
        params: superAdminParams({
          customer_name: user ? `${user.firstName} ${user.lastName}` : '',
          customer_id: user?.id ?? '',
          current_email: user?.email ?? '',
          requested_email: requestedEmail,
          reason: reason.trim() || '—',
          request_id: res.request.id,
        }),
      })
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Box sx={{ maxWidth: 560 }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>Change Email Address</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Your request will be reviewed by an administrator before your email is changed.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Paper variant="outlined" sx={{ p: 3 }}>
        <form onSubmit={onSubmit}>
          <Stack spacing={2}>
            <TextField
              label="Current Email"
              value={user?.email ?? ''}
              disabled
              fullWidth
              helperText="Taken from your account"
            />
            <TextField
              label="New Email"
              type="email"
              required
              placeholder="you@example.com"
              value={requestedEmail}
              onChange={(e) => setRequestedEmail(e.target.value)}
              fullWidth
            />
            <TextField
              label="Reason (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
            <Button
              type="submit"
              variant="contained"
              startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
              disabled={submitting || !requestedEmail}
              sx={{ alignSelf: 'flex-start' }}
            >
              Submit Request
            </Button>
          </Stack>
        </form>
      </Paper>
    </Box>
  )
}
