import { useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import SaveIcon from '@mui/icons-material/Save'
import ScheduleIcon from '@mui/icons-material/Schedule'
import PlaceIcon from '@mui/icons-material/Place'
import { settingsApi, type TenantSettings } from '../../api/settings'
import { apiErrorMessage } from '../../api/client'
import { Can } from '../../components/PermissionGate'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const TIMEZONES = [
  'UTC',
  'Africa/Cairo',
  'Africa/Casablanca',
  'Africa/Johannesburg',
  'Africa/Lagos',
  'Africa/Nairobi',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/New_York',
  'America/Sao_Paulo',
  'America/Toronto',
  'Asia/Bangkok',
  'Asia/Dhaka',
  'Asia/Dubai',
  'Asia/Hong_Kong',
  'Asia/Jakarta',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Manila',
  'Asia/Seoul',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Perth',
  'Australia/Sydney',
  'Europe/Berlin',
  'Europe/London',
  'Europe/Moscow',
  'Europe/Paris',
  'Pacific/Auckland',
]

export function CompanySettingsPage() {
  const qc = useQueryClient()
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => settingsApi.get() })

  if (settings.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box>
      {savedAt !== null && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSavedAt(null)}>
          Settings saved.
        </Alert>
      )}
      <SettingsForm
        key={JSON.stringify(settings.data ?? {})}
        initial={settings.data ?? {}}
        onSaved={() => { setSavedAt(Date.now()); qc.invalidateQueries({ queryKey: ['settings'] }) }}
        onDirty={() => setSavedAt(null)}
      />
    </Box>
  )
}

function SectionHeader({
  icon,
  title,
  description,
}: {
  icon: ReactNode
  title: string
  description: string
}) {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'flex-start', sm: 'center' }} sx={{ mb: 2.5 }}>
      <Avatar
        variant="rounded"
        sx={{ width: 40, height: 40, backgroundImage: 'none', bgcolor: 'rgba(79, 70, 229, 0.1)', color: '#4f46e5' }}
      >
        {icon}
      </Avatar>
      <Box>
        <Typography variant="subtitle1" fontWeight={800}>{title}</Typography>
        <Typography variant="body2" color="text.secondary">{description}</Typography>
      </Box>
    </Stack>
  )
}

function SettingsForm({
  initial,
  onSaved,
  onDirty,
}: {
  initial: Partial<TenantSettings>
  onSaved: () => void
  onDirty: () => void
}) {
  const [defaultLatitude, setDefaultLatitude] = useState(initial.defaultLatitude?.toString() ?? '')
  const [defaultLongitude, setDefaultLongitude] = useState(initial.defaultLongitude?.toString() ?? '')
  const [defaultRadiusMeters, setDefaultRadiusMeters] = useState(initial.defaultRadiusMeters?.toString() ?? '')
  const [defaultResumptionTime, setDefaultResumptionTime] = useState(initial.defaultResumptionTime ?? '08:00')
  const [defaultClosingTime, setDefaultClosingTime] = useState(initial.defaultClosingTime ?? '17:00')
  const [defaultLatePeriodMinutes, setDefaultLatePeriodMinutes] = useState(
    initial.defaultLatePeriodMinutes?.toString() ?? '15',
  )
  const [defaultWorkingDays, setDefaultWorkingDays] = useState<number[]>(initial.defaultWorkingDays ?? [1, 2, 3, 4, 5])
  const [timezone, setTimezone] = useState(initial.timezone ?? '')
  const [dirty, setDirty] = useState(false)
  const [saveError, setSaveError] = useState('')

  const markDirty = (setter: (v: string) => void) => (e: ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value)
    setDirty(true)
    onDirty()
  }

  const toggleDay = (day: number) => {
    setDefaultWorkingDays((prev) => {
      const next = prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
      setDirty(true)
      onDirty()
      return next
    })
  }

  const save = useMutation({
    mutationFn: () => {
      const body: Partial<TenantSettings> = {}
      if (defaultLatitude !== '') body.defaultLatitude = parseFloat(defaultLatitude)
      if (defaultLongitude !== '') body.defaultLongitude = parseFloat(defaultLongitude)
      if (defaultRadiusMeters !== '') body.defaultRadiusMeters = parseInt(defaultRadiusMeters, 10)
      if (defaultResumptionTime) body.defaultResumptionTime = defaultResumptionTime
      if (defaultClosingTime) body.defaultClosingTime = defaultClosingTime
      if (defaultLatePeriodMinutes !== '') body.defaultLatePeriodMinutes = parseInt(defaultLatePeriodMinutes, 10)
      if (defaultWorkingDays.length > 0) body.defaultWorkingDays = defaultWorkingDays
      if (timezone) body.timezone = timezone
      return settingsApi.update(body)
    },
    onSuccess: () => {
      setSaveError('')
      onSaved()
      setDirty(false)
    },
    onError: (e) => setSaveError(apiErrorMessage(e)),
  })

  return (
    <Box>
      <Typography variant="h5" fontWeight={800} gutterBottom>Company settings</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 640 }}>
        Organization-wide defaults used across schedules, attendance and reporting. These flow
        through the app whenever a branch, department or staff schedule is created.
      </Typography>

      {saveError && <Alert severity="error" sx={{ mb: 2 }}>{saveError}</Alert>}

      <Card variant="outlined" sx={{ mb: 2.5 }}>
        <CardContent>
          <SectionHeader
            icon={<ScheduleIcon fontSize="small" />}
            title="Working hours"
            description="Default hours that new schedules start from. Individual schedules can still override these."
          />
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Resumption time"
                type="time"
                value={defaultResumptionTime}
                onChange={markDirty(setDefaultResumptionTime)}
                fullWidth
                InputLabelProps={{ shrink: true }}
                helperText="Start of the working day (HH:MM)."
              />
              <TextField
                label="Closing time"
                type="time"
                value={defaultClosingTime}
                onChange={markDirty(setDefaultClosingTime)}
                fullWidth
                InputLabelProps={{ shrink: true }}
                helperText="End of the working day (HH:MM)."
              />
              <TextField
                label="Late period"
                type="number"
                value={defaultLatePeriodMinutes}
                onChange={markDirty(setDefaultLatePeriodMinutes)}
                fullWidth
                helperText="Grace period (minutes) before a clock-in is marked late."
              />
            </Stack>
            <Divider />
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Default working days
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {WEEKDAYS.map((day, i) => (
                  <Chip
                    key={day}
                    label={day}
                    color={defaultWorkingDays.includes(i) ? 'primary' : 'default'}
                    onClick={() => toggleDay(i)}
                    sx={{ cursor: 'pointer' }}
                  />
                ))}
              </Stack>
            </Box>
            <TextField
              select
              label="Timezone"
              value={timezone}
              onChange={(e) => { setTimezone(e.target.value); setDirty(true); onDirty() }}
              fullWidth
              helperText="IANA timezone used for schedule and attendance times."
            >
              <MenuItem value="">Use each branch's timezone</MenuItem>
              {!TIMEZONES.includes(timezone) && timezone && <MenuItem value={timezone}>{timezone}</MenuItem>}
              {TIMEZONES.map((tz) => (
                <MenuItem key={tz} value={tz}>{tz}</MenuItem>
              ))}
            </TextField>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 2.5 }}>
        <CardContent>
          <SectionHeader
            icon={<PlaceIcon fontSize="small" />}
            title="Attendance & location"
            description="Defaults used when a branch has no location set, for geofenced clock-ins."
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Default latitude"
              type="number"
              value={defaultLatitude}
              onChange={markDirty(setDefaultLatitude)}
              fullWidth
            />
            <TextField
              label="Default longitude"
              type="number"
              value={defaultLongitude}
              onChange={markDirty(setDefaultLongitude)}
              fullWidth
            />
            <TextField
              label="Default radius (meters)"
              type="number"
              value={defaultRadiusMeters}
              onChange={markDirty(setDefaultRadiusMeters)}
              fullWidth
              helperText="Geofence radius for clock-ins without a branch radius."
            />
          </Stack>
        </CardContent>
      </Card>

      <Stack direction="row" alignItems="center" spacing={2}>
        <Can permissions={['tenant.manage']}>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? 'Saving…' : 'Save settings'}
          </Button>
        </Can>
        {dirty && !save.isPending && (
          <Typography variant="body2" color="text.secondary">You have unsaved changes.</Typography>
        )}
      </Stack>
    </Box>
  )
}
