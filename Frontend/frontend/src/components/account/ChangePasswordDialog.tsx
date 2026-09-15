import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
} from '@mui/material'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import { authApi } from '../../api/auth'
import { apiErrorMessage } from '../../api/client'
import { useAuthStore } from '../../store/auth'

export function ChangePasswordDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [show, setShow] = useState(false)

  function reset() {
    setCurrentPassword('')
    setNewPassword('')
    setConfirm('')
    setError('')
    setShow(false)
  }

  const passwordType = show ? 'text' : 'password'

  function handleClose() {
    if (submitting) return
    reset()
    onClose()
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (newPassword !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setSubmitting(true)
    try {
      await authApi.changePassword(currentPassword, newPassword)
      reset()
      onClose()
      await useAuthStore.getState().logout()
      navigate('/login', { replace: true })
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>Change password</DialogTitle>
      <form onSubmit={onSubmit}>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Current password"
              type={passwordType}
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="Toggle current password visibility"
                      onClick={() => setShow(!show)}
                      edge="end"
                    >
                      {show ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              fullWidth
            />
            <TextField
              label="New password"
              type={passwordType}
              autoComplete="new-password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              helperText="Minimum 8 characters"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="Toggle new password visibility"
                      onClick={() => setShow(!show)}
                      edge="end"
                    >
                      {show ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              fullWidth
            />
            <TextField
              label="Confirm new password"
              type={passwordType}
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="Toggle confirm password visibility"
                      onClick={() => setShow(!show)}
                      edge="end"
                    >
                      {show ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={submitting}>
            {submitting ? <CircularProgress size={20} color="inherit" /> : 'Change password'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}