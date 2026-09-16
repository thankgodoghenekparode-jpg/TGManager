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
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import PauseCircleIcon from '@mui/icons-material/PauseCircle'
import PlayCircleIcon from '@mui/icons-material/PlayCircle'
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
            New company
          </Button>
        </Stack>
      </Stack>

      {(mutateStatus.error || create.error || update.error || (remove.error && apiErrorMessage(remove.error) !== '')) && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {apiErrorMessage(mutateStatus.error ?? create.error ?? update.error ?? remove.error)}
        </Alert>
      )}

      {tempPassword && (
        <Alert severity="info" sx={{ mb: 2 }} onClose={() => setTempPassword('')}>
          Company created. Temporary admin password (share once): <strong>{tempPassword}</strong>
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Company</TableCell>
              <TableCell>Plan</TableCell>
              <TableCell>Status</TableCell>
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
                <TableCell>{t.plan?.name ?? ''}</TableCell>
                <TableCell><StatusChip status={t.status} /></TableCell>
                <TableCell>{t.onboardingStatus}</TableCell>
                <TableCell align="right">
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
              <TableRow><TableCell colSpan={5} align="center">No tenants</TableCell></TableRow>
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
    adminFirstName: string
    adminLastName: string
    adminEmail: string
  }) => void
  onUpdate: (body: { planId: string; status: PlatformTenant['status']; timezone: string }) => void
  busy: boolean
}) {
  const creating = !tenant
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
      <DialogTitle>{creating ? 'New company' : `Edit ${tenant?.name}`}</DialogTitle>
      <DialogContent sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 1.5, sm: 2 } }}>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {creating ? (
            <>
              <TextField label="Company name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} fullWidth />
              <TextField select label="Plan" value={planCode} onChange={(e) => setPlanCode(e.target.value)} fullWidth>
                {plans.map((p) => (
                  <MenuItem key={p.id} value={p.code}>{p.name}</MenuItem>
                ))}
              </TextField>
              <TextField label="Company admin first name" value={adminFirstName} onChange={(e) => setAdminFirstName(e.target.value)} fullWidth />
              <TextField label="Company admin last name" value={adminLastName} onChange={(e) => setAdminLastName(e.target.value)} fullWidth />
              <TextField label="Company admin email" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} fullWidth />
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
              ? onCreate({ companyName, planCode, adminFirstName, adminLastName, adminEmail })
              : onUpdate({ planId, status, timezone })
          }
        >
          {creating ? 'Create company' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
