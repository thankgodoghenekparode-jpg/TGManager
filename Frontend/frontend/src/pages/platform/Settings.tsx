import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Box, Button, Checkbox, CircularProgress, Divider, FormControlLabel, Paper, Stack, TextField, Typography } from '@mui/material'
import SaveIcon from '@mui/icons-material/Save'
import { platformApi } from '../../api/platform'
import { apiErrorMessage } from '../../api/client'
import { useAuthStore } from '../../store/auth'

interface SettingsShape {
  platformName?: string
  supportEmail?: string
  platformUrl?: string
  logoUrl?: string
  maintenanceMode?: boolean
  maintenanceMessage?: string
  defaultMaxBranches?: number | null
  defaultMaxStaff?: number | null
  defaultMaxDocuments?: number | null
  defaultMaxStorageBytes?: number | null
  defaultMaxChatMessages?: number | null
  featureFlags?: Record<string, boolean>
  smtpHost?: string
  smtpPort?: number | null
  smtpUser?: string
  smtpPassword?: string
  smtpFromEmail?: string
}

export function SettingsPage() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isSuper = user?.role === 'SUPER_ADMIN'

  const settings = useQuery({
    queryKey: ['platform', 'settings'],
    queryFn: () => platformApi.settings() as Promise<SettingsShape>,
  })

  const update = useMutation({
    mutationFn: (body: Partial<SettingsShape>) => platformApi.updateSettings(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform', 'settings'] })
    },
  })

  if (settings.isLoading) return <CircularProgress />

  if (settings.error) {
    return <Alert severity="error">{apiErrorMessage(settings.error)}</Alert>
  }

  return (
    <SettingsForm
      initial={settings.data ?? {}}
      disabled={!isSuper}
      busy={update.isPending}
      error={update.error ? apiErrorMessage(update.error) : ''}
      onSave={(body) => update.mutate(body)}
    />
  )
}

function SettingsForm({
  initial,
  disabled,
  busy,
  error,
  onSave,
}: {
  initial: SettingsShape
  disabled: boolean
  busy: boolean
  error: string
  onSave: (body: Partial<SettingsShape>) => void
}) {
  const [form, setForm] = useState<SettingsShape>(() => ({
    ...initial,
    featureFlags: initial.featureFlags ?? {},
  }))
  const [saved, setSaved] = useState(false)

  const set = <K extends keyof SettingsShape>(key: K, value: SettingsShape[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setSaved(false)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSave(form)
    setSaved(true)
  }

  const num = (v: number | null | undefined) => (v === null ? '' : String(v ?? ''))

  return (
    <Box sx={{ maxWidth: 640 }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>Platform Settings</Typography>
      {disabled && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Only a super admin can edit platform settings.
        </Alert>
      )}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {saved && !error && <Alert severity="success" sx={{ mb: 2 }}>Settings saved.</Alert>}

      <form onSubmit={submit}>
        <Stack spacing={2}>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Platform identity</Typography>
            <Stack spacing={2}>
              <TextField label="Platform name" value={form.platformName ?? ''} disabled={disabled} onChange={(e) => set('platformName', e.target.value)} fullWidth />
              <TextField label="Support email" type="email" value={form.supportEmail ?? ''} disabled={disabled} onChange={(e) => set('supportEmail', e.target.value)} fullWidth />
              <TextField label="Platform URL" value={form.platformUrl ?? ''} disabled={disabled} onChange={(e) => set('platformUrl', e.target.value)} fullWidth />
              <TextField label="Logo URL" value={form.logoUrl ?? ''} disabled={disabled} onChange={(e) => set('logoUrl', e.target.value)} fullWidth />
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Maintenance</Typography>
            <Stack spacing={2}>
              <FormControlLabel
                control={<Checkbox checked={form.maintenanceMode ?? false} disabled={disabled} onChange={(e) => set('maintenanceMode', e.target.checked)} />}
                label="Maintenance mode"
              />
              <TextField label="Maintenance message" value={form.maintenanceMessage ?? ''} disabled={disabled} onChange={(e) => set('maintenanceMessage', e.target.value)} fullWidth multiline minRows={2} />
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Email (SMTP)</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Used to send password reset links and notifications. If left blank, the server-side EMAIL_* environment variables are used.
            </Typography>
            <Stack spacing={2}>
              <TextField label="SMTP host" value={form.smtpHost ?? ''} disabled={disabled} onChange={(e) => set('smtpHost', e.target.value)} fullWidth placeholder="smtp.example.com" />
              <TextField label="SMTP port" type="number" value={num(form.smtpPort)} disabled={disabled} onChange={(e) => set('smtpPort', e.target.value === '' ? null : parseInt(e.target.value, 10))} fullWidth placeholder="587" />
              <TextField label="SMTP username" value={form.smtpUser ?? ''} disabled={disabled} onChange={(e) => set('smtpUser', e.target.value)} fullWidth />
              <TextField label="SMTP password" type="password" value={form.smtpPassword ?? ''} disabled={disabled} onChange={(e) => set('smtpPassword', e.target.value)} fullWidth />
              <TextField label="From email" type="email" value={form.smtpFromEmail ?? ''} disabled={disabled} onChange={(e) => set('smtpFromEmail', e.target.value)} fullWidth placeholder="Zarox Connect <no-reply@example.com>" />
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Default plan limits</Typography>
            <Stack spacing={2}>
              <TextField label="Default max branches" type="number" value={num(form.defaultMaxBranches)} disabled={disabled} onChange={(e) => set('defaultMaxBranches', e.target.value === '' ? null : parseInt(e.target.value, 10))} fullWidth />
              <TextField label="Default max staff" type="number" value={num(form.defaultMaxStaff)} disabled={disabled} onChange={(e) => set('defaultMaxStaff', e.target.value === '' ? null : parseInt(e.target.value, 10))} fullWidth />
              <TextField label="Default max documents" type="number" value={num(form.defaultMaxDocuments)} disabled={disabled} onChange={(e) => set('defaultMaxDocuments', e.target.value === '' ? null : parseInt(e.target.value, 10))} fullWidth />
              <TextField label="Default max storage (bytes)" type="number" value={num(form.defaultMaxStorageBytes)} disabled={disabled} onChange={(e) => set('defaultMaxStorageBytes', e.target.value === '' ? null : parseInt(e.target.value, 10))} fullWidth />
              <TextField label="Default max chat messages" type="number" value={num(form.defaultMaxChatMessages)} disabled={disabled} onChange={(e) => set('defaultMaxChatMessages', e.target.value === '' ? null : parseInt(e.target.value, 10))} fullWidth />
            </Stack>
          </Paper>

          {!disabled && (
            <>
              <Divider />
              <Button type="submit" variant="contained" startIcon={<SaveIcon />} disabled={busy} sx={{ alignSelf: 'flex-start' }}>
                {busy ? <CircularProgress size={20} color="inherit" /> : 'Save settings'}
              </Button>
            </>
          )}
        </Stack>
      </form>
    </Box>
  )
}
