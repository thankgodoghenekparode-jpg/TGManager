import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Grid,
  IconButton,
  InputAdornment,
  Link,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import SchoolIcon from '@mui/icons-material/School'
import BusinessIcon from '@mui/icons-material/Business'
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import PersonOutlineIcon from '@mui/icons-material/PersonOutline'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import { useAuthStore } from '../../store/auth'
import { apiErrorMessage } from '../../api/client'
import { AuthShell } from './AuthShell'

export function RegisterPage() {
  const navigate = useNavigate()
  const registerUser = useAuthStore((s) => s.register)

  const [type, setType] = useState<'SCHOOL' | 'COMPANY'>('SCHOOL')
  const [organizationName, setOrganizationName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setSubmitting(true)
    try {
      const res = await registerUser({
        organizationName,
        type,
        firstName,
        lastName,
        email,
        password,
      })

      if (res.tenant.type === 'SCHOOL') {
        navigate('/school', { replace: true })
      } else {
        navigate('/app', { replace: true })
      }
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      headline="Create Account"
      title="Choose your workspace type and get set up in seconds"
    >
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

          {/* Type Selector Cards */}
          <Box>
            <Typography
              variant="caption"
              sx={{
                color: '#8A8F99',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                display: 'block',
                mb: 1,
              }}
            >
              Select Workspace Mode
            </Typography>
            <Grid container spacing={1.5}>
              <Grid item xs={6}>
                <Paper
                  variant="outlined"
                  onClick={() => setType('SCHOOL')}
                  sx={{
                    p: 1.5,
                    cursor: 'pointer',
                    borderRadius: 2.5,
                    borderWidth: type === 'SCHOOL' ? 2 : 1,
                    borderColor: type === 'SCHOOL' ? '#EC0618' : 'rgba(255, 255, 255, 0.12)',
                    bgcolor: type === 'SCHOOL' ? 'rgba(236, 6, 24, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      borderColor: '#EC0618',
                      bgcolor: 'rgba(236, 6, 24, 0.08)',
                    },
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                    <SchoolIcon sx={{ color: type === 'SCHOOL' ? '#FF4D5E' : '#8A8F99', fontSize: 22 }} />
                    <Typography variant="body2" fontWeight={800} sx={{ color: type === 'SCHOOL' ? '#FFFFFF' : '#D1D5DB' }}>
                      School
                    </Typography>
                  </Stack>
                  <Typography variant="caption" sx={{ color: '#9CA3AF', display: 'block', fontSize: '0.72rem', lineHeight: 1.3 }}>
                    Students, gate attendance, grades, report cards & fees
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={6}>
                <Paper
                  variant="outlined"
                  onClick={() => setType('COMPANY')}
                  sx={{
                    p: 1.5,
                    cursor: 'pointer',
                    borderRadius: 2.5,
                    borderWidth: type === 'COMPANY' ? 2 : 1,
                    borderColor: type === 'COMPANY' ? '#EC0618' : 'rgba(255, 255, 255, 0.12)',
                    bgcolor: type === 'COMPANY' ? 'rgba(236, 6, 24, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      borderColor: '#EC0618',
                      bgcolor: 'rgba(236, 6, 24, 0.08)',
                    },
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                    <BusinessIcon sx={{ color: type === 'COMPANY' ? '#FF4D5E' : '#8A8F99', fontSize: 22 }} />
                    <Typography variant="body2" fontWeight={800} sx={{ color: type === 'COMPANY' ? '#FFFFFF' : '#D1D5DB' }}>
                      Company
                    </Typography>
                  </Stack>
                  <Typography variant="caption" sx={{ color: '#9CA3AF', display: 'block', fontSize: '0.72rem', lineHeight: 1.3 }}>
                    Branches, staff schedules, workflows, memos & inventory
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </Box>

          {/* Mode Highlights Banner */}
          <Box
            sx={{
              p: 1.25,
              borderRadius: 2,
              bgcolor: 'rgba(255, 255, 255, 0.04)',
              border: '1px dashed rgba(255, 255, 255, 0.15)',
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1}>
              <CheckCircleOutlineIcon sx={{ color: '#10B981', fontSize: 18 }} />
              <Typography variant="caption" sx={{ color: '#D1D5DB', fontWeight: 600 }}>
                {type === 'SCHOOL'
                  ? 'Configures WAEC Continuous Assessment, Student QR IDs, and Fee schedules.'
                  : 'Configures Branch/Department hierarchies, Staff shifts, and Workflow routing.'}
              </Typography>
            </Stack>
          </Box>

          <TextField
            label={type === 'SCHOOL' ? 'School / Institution Name' : 'Company / Organization Name'}
            placeholder={type === 'SCHOOL' ? 'e.g. Apex Model College' : 'e.g. Apex Global Ventures'}
            required
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  {type === 'SCHOOL' ? (
                    <SchoolIcon sx={{ color: '#8A8F99', fontSize: 20 }} />
                  ) : (
                    <BusinessIcon sx={{ color: '#8A8F99', fontSize: 20 }} />
                  )}
                </InputAdornment>
              ),
            }}
          />

          <Grid container spacing={1.5}>
            <Grid item xs={6}>
              <TextField
                label={type === 'SCHOOL' ? 'Principal First Name' : 'Admin First Name'}
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonOutlineIcon sx={{ color: '#8A8F99', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Last Name"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                fullWidth
              />
            </Grid>
          </Grid>

          <TextField
            label={type === 'SCHOOL' ? 'School Official Email' : 'Corporate Email'}
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
            autoComplete="new-password"
            required
            helperText="Minimum 8 characters"
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

          <TextField
            label="Confirm Password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockOutlinedIcon sx={{ color: '#8A8F99', fontSize: 20 }} />
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
              mt: 1,
            }}
          >
            {submitting ? (
              <CircularProgress size={22} color="inherit" />
            ) : type === 'SCHOOL' ? (
              'Create School Workspace'
            ) : (
              'Create Company Workspace'
            )}
          </Button>

          <Stack direction="row" justifyContent="center" alignItems="center" spacing={1} sx={{ pt: 1 }}>
            <Typography variant="body2" sx={{ color: '#9CA3AF' }}>
              Already registered with TGManager?
            </Typography>
            <Link
              href="/login"
              variant="body2"
              sx={{
                color: '#FF4D5E',
                fontWeight: 700,
                textDecoration: 'none',
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              Sign In
            </Link>
          </Stack>
        </Stack>
      </form>
    </AuthShell>
  )
}
