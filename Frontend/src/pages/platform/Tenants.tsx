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
  DialogContentText,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
  Grid,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import PauseCircleIcon from '@mui/icons-material/PauseCircle'
import PlayCircleIcon from '@mui/icons-material/PlayCircle'
import ScheduleIcon from '@mui/icons-material/Schedule'
import SchoolIcon from '@mui/icons-material/School'
import BusinessIcon from '@mui/icons-material/Business'
import { platformApi, type PlatformPlan, type PlatformTenant } from '../../api/platform'
import { apiErrorMessage } from '../../api/client'

export function TenantsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(20)
  const [confirm, setConfirm] = useState<{ tenant: PlatformTenant; action: 'suspend' | 'activate' } | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<PlatformTenant | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PlatformTenant | null>(null)
  const [accessTarget, setAccessTarget] = useState<PlatformTenant | null>(null)
  const [tempPassword, setTempPassword] = useState('')

  const plans = useQuery({ queryKey: ['platform', 'plans'], queryFn: () => platformApi.plans() })

  const tenants = useQuery({
    queryKey: ['platform', 'tenants', search, page, rowsPerPage],
    queryFn: () =>
      platformApi.tenants({
        search: search || undefined,
        limit: rowsPerPage,
        offset: page * rowsPerPage,
      }),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['platform', 'tenants'] })
  }

  const mutateStatus = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'suspend' | 'activate' }) =>
      action === 'suspend' ? platformApi.suspendTenant(id) : platformApi.activateTenant(id),
    onSuccess: () => {
      invalidate()
      setConfirm(null)
    },
  })

  const create = useMutation({
    mutationFn: (body: {
      companyName: string
      planCode: string
      type: 'COMPANY' | 'SCHOOL'
      adminFirstName: string
      adminLastName: string
      adminEmail: string
    }) => platformApi.createTenant(body),
    onSuccess: (res) => {
      setCreating(false)
      setTempPassword(res.tempPassword)
      invalidate()
    },
  })

  const update = useMutation({
    mutationFn: (body: { id: string; planId?: string; status?: PlatformTenant['status']; timezone?: string }) =>
      platformApi.updateTenant(body.id, body),
    onSuccess: () => {
      setEditing(null)
      invalidate()
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => platformApi.deleteTenant(id),
    onSuccess: () => {
      setDeleteTarget(null)
      invalidate()
    },
  })

  const setAccess = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { endsAt?: string | null; durationDays?: number } }) =>
      platformApi.setTenantAccess(id, body),
    onSuccess: () => {
      setAccessTarget(null)
      invalidate()
    },
  })

  const rows = tenants.data?.items ?? []

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" fontWeight={700}>Tenants</Typography>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
          <TextField
            label="Search"
            size="small"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(0)
            }}
          />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => { setEditing(null); setCreating(true) }}
          >
            New tenant
          </Button>
        </Stack>
      </Stack>

      {(mutateStatus.error || create.error || update.error || setAccess.error || (remove.error && apiErrorMessage(remove.error) !== '')) && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {apiErrorMessage(mutateStatus.error ?? create.error ?? update.error ?? setAccess.error ?? remove.error)}
        </Alert>
      )}

      {tempPassword && (
        <Alert severity="info" sx={{ mb: 2 }} onClose={() => setTempPassword('')}>
          Tenant created. Temporary admin password (share once): <strong>{tempPassword}</strong>
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Tenant</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Plan</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Access</TableCell>
              <TableCell>Onboarding</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((t) => (
              <TableRow key={t.id} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight={600}>{t.name}</Typography>
                  <Typography variant="caption" color="text.secondary">@{t.slug}</Typography>
                  {t.adminEmail && (
                    <Typography variant="caption" display="block" color="text.secondary">
                      {t.adminEmail}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Chip
                    icon={t.type === 'SCHOOL' ? <SchoolIcon sx={{ '&&': { fontSize: 16 } }} /> : <BusinessIcon sx={{ '&&': { fontSize: 16 } }} />}
                    label={t.type === 'SCHOOL' ? 'School' : 'Company'}
                    size="small"
                    color={t.type === 'SCHOOL' ? 'primary' : 'default'}
                    variant={t.type === 'SCHOOL' ? 'filled' : 'outlined'}
                  />
                </TableCell>
                <TableCell>{t.plan?.name ?? ''}</TableCell>
                <TableCell><StatusChip status={t.status} /></TableCell>
                <TableCell><AccessChip tenant={t} /></TableCell>
                <TableCell>{t.onboardingStatus}</TableCell>
                <TableCell align="right">
                  <IconButton
                    title="Set access duration"
                    color="primary"
                    onClick={() => setAccessTarget(t)}
                  >
                    <ScheduleIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    title="Edit"
                    onClick={() => { setCreating(true); setEditing(t) }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    title="Delete"
                    color="error"
                    onClick={() => setDeleteTarget(t)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                  {t.status === 'ACTIVE' ? (
                    <IconButton title="Suspend" onClick={() => setConfirm({ tenant: t, action: 'suspend' })}><PauseCircleIcon /></IconButton>
                  ) : (
                    <IconButton title="Activate" color="success" onClick={() => setConfirm({ tenant: t, action: 'activate' })}><PlayCircleIcon /></IconButton>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={7} align="center">No tenants</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={tenants.data?.total ?? 0}
        rowsPerPageOptions={[10, 20, 50]}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={(_, p) => setPage(p)}
        onRowsPerPageChange={(e) => {
          setRowsPerPage(parseInt(e.target.value, 10))
          setPage(0)
        }}
      />

      <AccessDialog
        open={accessTarget !== null}
        tenant={accessTarget}
        busy={setAccess.isPending}
        onClose={() => setAccessTarget(null)}
        onSubmit={(body) => accessTarget && setAccess.mutate({ id: accessTarget.id, body })}
      />

      {creating && (
        <TenantDialog
          tenant={editing}
          plans={(plans.data ?? []).filter((p) => p.isActive)}
          open={creating}
          onClose={() => { setCreating(false); setEditing(null) }}
          onCreate={(body) => create.mutate(body)}
          onUpdate={(body) => update.mutate({ id: editing?.id ?? '', ...body })}
          busy={create.isPending || update.isPending}
        />
      )}

      <Dialog open={confirm !== null} onClose={() => setConfirm(null)} fullWidth maxWidth="xs">
        <DialogTitle>{confirm?.action === 'suspend' ? 'Suspend tenant' : 'Activate tenant'}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {confirm?.action === 'suspend'
              ? `Suspend "${confirm?.tenant.name}"? Its users will lose access while suspended.`
              : `Reactivate "${confirm?.tenant.name}"?`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>Cancel</Button>
          <Button
            color={confirm?.action === 'suspend' ? 'error' : 'primary'}
            onClick={() => confirm && mutateStatus.mutate({ id: confirm.tenant.id, action: confirm.action })}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Permanently delete tenant</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Delete <strong>{deleteTarget?.name}</strong> and <strong>all</strong> of its data? This is permanent and
            cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button
            color="error"
            disabled={remove.isPending}
            onClick={() => deleteTarget && remove.mutate(deleteTarget.id)}
          >
            Delete permanently
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

function StatusChip({ status }: { status: PlatformTenant['status'] }) {
  const color = status === 'ACTIVE' ? 'success' : status === 'SUSPENDED' ? 'error' : 'warning'
  return <Chip label={status} size="small" color={color} />
}

function AccessChip({ tenant }: { tenant: PlatformTenant }) {
  if (tenant.accessExpired) {
    return <Chip label="Expired" size="small" color="error" variant="filled" />
  }
  if (!tenant.accessExpiresAt) {
    return <Chip label="No expiry" size="small" variant="outlined" />
  }
  const ends = new Date(tenant.accessExpiresAt)
  const daysLeft = Math.ceil((ends.getTime() - Date.now()) / 86_400_000)
  const soon = daysLeft <= 7
  return (
    <Chip
      label={`Ends ${ends.toLocaleDateString()}${soon ? ` (${daysLeft}d)` : ''}`}
      size="small"
      color={soon ? 'warning' : 'default'}
      variant={soon ? 'filled' : 'outlined'}
    />
  )
}

const ACCESS_PRESETS = [7, 30, 60, 90, 180, 365]

function AccessDialog({
  open,
  tenant,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean
  tenant: PlatformTenant | null
  busy: boolean
  onClose: () => void
  onSubmit: (body: { endsAt?: string | null; durationDays?: number }) => void
}) {
  const [mode, setMode] = useState<'preset' | 'custom' | 'unlimited'>('preset')
  const [preset, setPreset] = useState(30)
  const [customDate, setCustomDate] = useState('')
  const [error, setError] = useState('')

  const currentExpiry = tenant?.accessExpiresAt
    ? new Date(tenant.accessExpiresAt).toLocaleString()
    : 'No expiry (unlimited)'

  const submit = () => {
    setError('')
    if (mode === 'unlimited') {
      onSubmit({ endsAt: null })
      return
    }
    if (mode === 'preset') {
      onSubmit({ durationDays: preset })
      return
    }
    if (!customDate) {
      setError('Pick a date and time')
      return
    }
    const when = new Date(customDate)
    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      setError('Choose a date and time in the future')
      return
    }
    onSubmit({ endsAt: when.toISOString() })
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Set access — {tenant?.name}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Current: <strong>{currentExpiry}</strong>. When the window elapses the
            tenant is suspended automatically until access is granted again.
          </Typography>

          <TextField
            select
            size="small"
            label="Access type"
            value={mode}
            onChange={(e) => setMode(e.target.value as typeof mode)}
          >
            <MenuItem value="preset">For a duration</MenuItem>
            <MenuItem value="custom">Until a specific date</MenuItem>
            <MenuItem value="unlimited">No expiry (restore unlimited)</MenuItem>
          </TextField>

          {mode === 'preset' && (
            <TextField
              select
              size="small"
              label="Duration"
              value={preset}
              onChange={(e) => setPreset(Number(e.target.value))}
            >
              {ACCESS_PRESETS.map((d) => (
                <MenuItem key={d} value={d}>
                  {d} days
                </MenuItem>
              ))}
            </TextField>
          )}

          {mode === 'custom' && (
            <TextField
              size="small"
              label="Expires at"
              type="datetime-local"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          )}

          {mode === 'unlimited' && (
            <Alert severity="info">
              The tenant will keep access with no automatic expiry. You can still
              suspend it manually.
            </Alert>
          )}

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={busy} onClick={submit}>
          {mode === 'unlimited' ? 'Grant unlimited access' : 'Grant access'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function TenantDialog({
  tenant,
  plans,
  open,
  onClose,
  onCreate,
  onUpdate,
  busy,
}: {
  tenant: PlatformTenant | null
  plans: PlatformPlan[]
  open: boolean
  onClose: () => void
  onCreate: (body: {
    companyName: string
    planCode: string
    type: 'COMPANY' | 'SCHOOL'
    adminFirstName: string
    adminLastName: string
    adminEmail: string
  }) => void
  onUpdate: (body: { planId: string; status: PlatformTenant['status']; timezone: string }) => void
  busy: boolean
}) {
  const creating = !tenant
  const [type, setType] = useState<'COMPANY' | 'SCHOOL'>('COMPANY')
  const [companyName, setCompanyName] = useState(tenant?.name ?? '')
  const [adminFirstName, setAdminFirstName] = useState('')
  const [adminLastName, setAdminLastName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [planId, setPlanId] = useState(tenant?.plan?.code ? plans.find((p) => p.code === tenant.plan?.code)?.id ?? '' : '')
  const [planCode, setPlanCode] = useState(plans[0]?.code ?? '')
  const [status, setStatus] = useState<PlatformTenant['status']>(tenant?.status ?? 'ACTIVE')
  const [timezone, setTimezone] = useState(tenant?.timezone ?? 'UTC')

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {creating
          ? type === 'SCHOOL' ? 'New School Tenant' : 'New Company Tenant'
          : `Edit ${tenant?.name}`}
      </DialogTitle>
      <DialogContent sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 1.5, sm: 2 } }}>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {creating ? (
            <>
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Organization Type
              </Typography>
              <Grid container spacing={1.5}>
                <Grid item xs={6}>
                  <Paper
                    variant="outlined"
                    onClick={() => setType('COMPANY')}
                    sx={{
                      p: 1.5,
                      cursor: 'pointer',
                      borderRadius: 2,
                      borderWidth: type === 'COMPANY' ? 2 : 1,
                      borderColor: type === 'COMPANY' ? 'primary.main' : 'divider',
                      bgcolor: type === 'COMPANY' ? 'action.selected' : 'background.paper',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.2,
                      transition: 'all 0.15s ease-in-out',
                    }}
                  >
                    <BusinessIcon color={type === 'COMPANY' ? 'primary' : 'action'} />
                    <Box>
                      <Typography variant="body2" fontWeight={700}>Company</Typography>
                      <Typography variant="caption" color="text.secondary">Corporate office</Typography>
                    </Box>
                  </Paper>
                </Grid>
                <Grid item xs={6}>
                  <Paper
                    variant="outlined"
                    onClick={() => setType('SCHOOL')}
                    sx={{
                      p: 1.5,
                      cursor: 'pointer',
                      borderRadius: 2,
                      borderWidth: type === 'SCHOOL' ? 2 : 1,
                      borderColor: type === 'SCHOOL' ? 'primary.main' : 'divider',
                      bgcolor: type === 'SCHOOL' ? 'action.selected' : 'background.paper',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.2,
                      transition: 'all 0.15s ease-in-out',
                    }}
                  >
                    <SchoolIcon color={type === 'SCHOOL' ? 'primary' : 'action'} />
                    <Box>
                      <Typography variant="body2" fontWeight={700}>School</Typography>
                      <Typography variant="caption" color="text.secondary">Educational institute</Typography>
                    </Box>
                  </Paper>
                </Grid>
              </Grid>

              <TextField
                label={type === 'SCHOOL' ? 'School / Institution name' : 'Company name'}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                fullWidth
                required
              />
              <TextField select label="Plan" value={planCode} onChange={(e) => setPlanCode(e.target.value)} fullWidth>
                {plans.map((p) => (
                  <MenuItem key={p.id} value={p.code}>{p.name}</MenuItem>
                ))}
              </TextField>
              <TextField
                label={type === 'SCHOOL' ? 'Principal / Admin first name' : 'Company admin first name'}
                value={adminFirstName}
                onChange={(e) => setAdminFirstName(e.target.value)}
                fullWidth
                required
              />
              <TextField
                label={type === 'SCHOOL' ? 'Principal / Admin last name' : 'Company admin last name'}
                value={adminLastName}
                onChange={(e) => setAdminLastName(e.target.value)}
                fullWidth
                required
              />
              <TextField
                label={type === 'SCHOOL' ? 'School admin email' : 'Company admin email'}
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                fullWidth
                required
              />
            </>
          ) : (
            <>
              <TextField select label="Plan" value={planId} onChange={(e) => setPlanId(e.target.value)} fullWidth>
                {plans.map((p) => (
                  <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                ))}
              </TextField>
              <TextField select label="Status" value={status} onChange={(e) => setStatus(e.target.value as PlatformTenant['status'])} fullWidth>
                <MenuItem value="ACTIVE">Active</MenuItem>
                <MenuItem value="SUSPENDED">Suspended</MenuItem>
                <MenuItem value="TRIAL_ENDED">Trial ended</MenuItem>
              </TextField>
              <TextField label="Timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} fullWidth />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 2 }, flexWrap: 'wrap' }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={
            busy ||
            (creating
              ? !companyName || !adminFirstName || !adminLastName || !adminEmail || !planCode
              : !planId)
          }
          onClick={() =>
            creating
              ? onCreate({ companyName, planCode, type, adminFirstName, adminLastName, adminEmail })
              : onUpdate({ planId, status, timezone })
          }
        >
          {creating ? (type === 'SCHOOL' ? 'Create school' : 'Create company') : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
