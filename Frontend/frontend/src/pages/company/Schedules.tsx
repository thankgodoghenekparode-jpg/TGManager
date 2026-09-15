import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import { schedulesApi, type Schedule, type ScheduleScope } from '../../api/schedules'
import { branchesApi } from '../../api/branches'
import { departmentsApi } from '../../api/departments'
import { staffApi } from '../../api/staff'
import { settingsApi, type TenantSettings } from '../../api/settings'
import { apiErrorMessage } from '../../api/client'
import { Can } from '../../components/PermissionGate'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function SchedulesPage() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Schedule | null>(null)
  const [creating, setCreating] = useState(false)
  const [confirm, setConfirm] = useState<Schedule | null>(null)

  const branches = useQuery({ queryKey: ['branches'], queryFn: () => branchesApi.list() })
  const departments = useQuery({ queryKey: ['departments'], queryFn: () => departmentsApi.list() })
  const staff = useQuery({ queryKey: ['staff'], queryFn: () => staffApi.list() })
  const schedules = useQuery({ queryKey: ['schedules'], queryFn: () => schedulesApi.list() })
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => settingsApi.get() })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['schedules'] })

  const save = useMutation({
    mutationFn: (body: Parameters<typeof schedulesApi.create>[0]) =>
      editing ? schedulesApi.update(editing.id, body) : schedulesApi.create(body),
    onSuccess: () => { setCreating(false); setEditing(null); invalidate() },
  })

  const remove = useMutation({
    mutationFn: (id: string) => schedulesApi.remove(id),
    onSuccess: () => { setConfirm(null); invalidate() },
  })

  const rows = schedules.data ?? []

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" fontWeight={700}>Schedules</Typography>
        <Can permissions={['schedule.manage']}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditing(null); setCreating(true) }}>
            New schedule
          </Button>
        </Can>
      </Stack>

      {(save.error || remove.error) && <Alert severity="error" sx={{ mb: 2 }}>{apiErrorMessage(save.error ?? remove.error)}</Alert>}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Target</TableCell>
              <TableCell>Scope</TableCell>
              <TableCell>Hours</TableCell>
              <TableCell>Late window</TableCell>
              <TableCell>Working days</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((s) => (
              <TableRow key={s.id} hover>
                <TableCell>{scheduleLabel(s)}</TableCell>
                <TableCell><Chip label={s.scope} size="small" /></TableCell>
                <TableCell>{s.resumptionTime} – {s.closingTime}</TableCell>
                <TableCell>{s.latePeriodMinutes} min</TableCell>
                <TableCell>
                  {s.workingDays.length === 0 ? 'Every day' : s.workingDays.map((d) => WEEKDAYS[d]).join(', ')}
                </TableCell>
                <TableCell align="right">
                  <Can permissions={['schedule.manage']}>
                    <IconButton onClick={() => { setEditing(s); setCreating(true) }}><EditIcon fontSize="small" /></IconButton>
                    <IconButton color="error" onClick={() => setConfirm(s)}><DeleteIcon fontSize="small" /></IconButton>
                  </Can>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={6} align="center">No schedules</TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>

      {(creating || editing) && (
        <ScheduleDialog
          schedule={editing}
          open
          branches={(branches.data ?? []).map((b) => ({ id: b.id, name: b.name }))}
          departments={(departments.data ?? []).map((d) => ({ id: d.id, name: d.name }))}
          staff={(staff.data ?? []).map((s) => ({ id: s.id, name: `${s.user.firstName} ${s.user.lastName}` }))}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSave={(body) => save.mutate(body)}
          busy={save.isPending}
          defaults={settings.data}
        />
      )}

      <Dialog open={confirm !== null} onClose={() => setConfirm(null)}>
        <DialogTitle>Delete schedule</DialogTitle>
        <DialogContent>Delete the schedule for "{confirm && scheduleLabel(confirm)}"?</DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>Cancel</Button>
          <Button color="error" onClick={() => confirm && remove.mutate(confirm.id)}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

function scheduleLabel(s: Schedule): string {
  if (s.scope === 'BRANCH' && s.branch) return s.branch.name
  if (s.scope === 'DEPARTMENT' && s.department) return s.department.name
  if (s.scope === 'STAFF' && s.staffRecord?.user) return `${s.staffRecord.user.firstName} ${s.staffRecord.user.lastName}`
  if (s.scope === 'STAFF' && s.staffRecordId) return s.staffRecordId
  if (s.scope === 'BRANCH' && s.branchId) return s.branchId
  if (s.scope === 'DEPARTMENT' && s.departmentId) return s.departmentId
  return s.scope
}

function ScheduleDialog({
  schedule,
  open,
  branches,
  departments,
  staff,
  defaults,
  onClose,
  onSave,
  busy,
}: {
  schedule: Schedule | null
  open: boolean
  branches: Array<{ id: string; name: string }>
  departments: Array<{ id: string; name: string }>
  staff: Array<{ id: string; name: string }>
  defaults?: Partial<TenantSettings>
  onClose: () => void
  onSave: (body: Parameters<typeof schedulesApi.create>[0]) => void
  busy: boolean
}) {
  const [scope, setScope] = useState<ScheduleScope>(schedule?.scope ?? 'BRANCH')
  const [branchId, setBranchId] = useState(schedule?.branchId ?? '')
  const [departmentId, setDepartmentId] = useState(schedule?.departmentId ?? '')
  const [staffRecordId, setStaffRecordId] = useState(schedule?.staffRecordId ?? '')
  const [resumptionTime, setResumptionTime] = useState(schedule?.resumptionTime ?? defaults?.defaultResumptionTime ?? '08:00')
  const [closingTime, setClosingTime] = useState(schedule?.closingTime ?? defaults?.defaultClosingTime ?? '17:00')
  const [latePeriod, setLatePeriod] = useState(String(schedule?.latePeriodMinutes ?? defaults?.defaultLatePeriodMinutes ?? 15))
  const [workingDays, setWorkingDays] = useState<number[]>(
    schedule?.workingDays ?? defaults?.defaultWorkingDays ?? [1, 2, 3, 4, 5],
  )

  const toggleDay = (day: number) => {
    setWorkingDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()))
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{schedule ? 'Edit schedule' : 'New schedule'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <FormControl>
            <InputLabel>Scope</InputLabel>
            <Select label="Scope" value={scope} onChange={(e) => { setScope(e.target.value as ScheduleScope); setBranchId(''); setDepartmentId(''); setStaffRecordId('') }}>
              <MenuItem value="BRANCH">Whole branch</MenuItem>
              <MenuItem value="DEPARTMENT">Department</MenuItem>
              <MenuItem value="STAFF">Individual staff</MenuItem>
            </Select>
          </FormControl>

          {scope === 'BRANCH' && (
            <TextField select label="Branch" value={branchId} onChange={(e) => setBranchId(e.target.value)} fullWidth>
              <MenuItem value="">Select branch…</MenuItem>
              {branches.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
            </TextField>
          )}

          {scope === 'DEPARTMENT' && (
            <TextField select label="Department" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} fullWidth>
              <MenuItem value="">Select department…</MenuItem>
              {departments.map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
            </TextField>
          )}

          {scope === 'STAFF' && (
            <TextField select label="Staff member" value={staffRecordId} onChange={(e) => setStaffRecordId(e.target.value)} fullWidth>
              <MenuItem value="">Select staff…</MenuItem>
              {staff.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
            </TextField>
          )}

          <Stack direction="row" spacing={2}>
            <TextField label="Resumption (HH:MM)" value={resumptionTime} onChange={(e) => setResumptionTime(e.target.value)} fullWidth />
            <TextField label="Closing (HH:MM)" value={closingTime} onChange={(e) => setClosingTime(e.target.value)} fullWidth />
          </Stack>
          <TextField label="Late period (minutes)" type="number" value={latePeriod} onChange={(e) => setLatePeriod(e.target.value)} fullWidth />

          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>Working days</Typography>
            <Stack direction="row" spacing={1}>
              {WEEKDAYS.map((day, i) => (
                <Chip key={day} label={day} color={workingDays.includes(i) ? 'primary' : 'default'} onClick={() => toggleDay(i)} sx={{ cursor: 'pointer' }} />
              ))}
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={busy || !resumptionTime || !closingTime || (scope === 'BRANCH' && !branchId) || (scope === 'DEPARTMENT' && !departmentId) || (scope === 'STAFF' && !staffRecordId)}
          onClick={() => onSave({
            scope,
            branchId: scope === 'BRANCH' ? branchId : null,
            departmentId: scope === 'DEPARTMENT' ? departmentId : null,
            staffRecordId: scope === 'STAFF' ? staffRecordId : null,
            resumptionTime,
            closingTime,
            latePeriodMinutes: parseInt(latePeriod || '15', 10),
            workingDays,
          })}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}
