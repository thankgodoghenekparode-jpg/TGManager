import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Box,
  Chip,
  MenuItem,
  Paper,
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
import { auditApi } from '../../api/audit'
import { staffApi } from '../../api/staff'

const AUDIT_ACTIONS = [
  'TENANT_SETTINGS_UPDATED',
  'INTEGRATION_API_KEY_CREATE',
  'INTEGRATION_API_KEY_REVOKE',
  'INTEGRATION_WEBHOOK_CREATE',
  'INTEGRATION_WEBHOOK_DELETE',
  'INTEGRATION_WORKFLOW_START',
  'INTEGRATION_WORKFLOW_STEP_COMPLETE',
  'WORKFLOW_STARTED',
  'WORKFLOW_STEP_APPROVED',
  'WORKFLOW_STEP_COMPLETED',
]

export function AuditLogsPage() {
  const [entityType, setEntityType] = useState('')
  const [action, setAction] = useState('')
  const [userId, setUserId] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [limit, setLimit] = useState(50)

  const staff = useQuery({ queryKey: ['staff'], queryFn: () => staffApi.list() })
  const logs = useQuery({
    queryKey: ['audit', { entityType, action, userId, from: fromDate, to: toDate, limit }],
    queryFn: () =>
      auditApi.list({
        entityType: entityType || undefined,
        action: action || undefined,
        userId: userId || undefined,
        from: fromDate ? new Date(fromDate).toISOString() : undefined,
        to: toDate ? new Date(toDate + 'T23:59:59').toISOString() : undefined,
        limit,
      }),
  })

  const rows = logs.data ?? []
  const userName = (uid: string | null) => {
    if (!uid) return '—'
    const s = staff.data?.find((x) => x.user.id === uid)
    return s ? `${s.user.firstName} ${s.user.lastName}` : uid.slice(0, 8)
  }

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>Audit Logs</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        A chronological record of sensitive actions performed across the company.
      </Typography>

      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        <TextField select label="Action" size="small" value={action} onChange={(e) => setAction(e.target.value)} sx={{ minWidth: 240, width: { xs: '100%', sm: 'auto' } }}>
          <MenuItem value="">All actions</MenuItem>
          {AUDIT_ACTIONS.map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
        </TextField>
        <TextField label="Entity type" size="small" value={entityType} onChange={(e) => setEntityType(e.target.value)} placeholder="e.g. WorkflowInstance" sx={{ minWidth: 200, width: { xs: '100%', sm: 'auto' } }} />
        <TextField select label="User" size="small" value={userId} onChange={(e) => setUserId(e.target.value)} sx={{ minWidth: 200, width: { xs: '100%', sm: 'auto' } }}>
          <MenuItem value="">All users</MenuItem>
          {(staff.data ?? []).map((s) => (
            <MenuItem key={s.user.id} value={s.user.id}>{s.user.firstName} {s.user.lastName}</MenuItem>
          ))}
        </TextField>
        <TextField label="From" type="date" size="small" value={fromDate} onChange={(e) => setFromDate(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField label="To" type="date" size="small" value={toDate} onChange={(e) => setToDate(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField select label="Limit" size="small" value={limit} onChange={(e) => setLimit(Number(e.target.value))} sx={{ minWidth: 110, width: { xs: '100%', sm: 'auto' } }}>
          {[20, 50, 100, 200].map((l) => <MenuItem key={l} value={l}>{l}</MenuItem>)}
        </TextField>
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>User</TableCell>
              <TableCell>Action</TableCell>
              <TableCell>Entity</TableCell>
              <TableCell>Details</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(r.createdAt).toLocaleString()}</TableCell>
                <TableCell>{userName(r.userId)}</TableCell>
                <TableCell><Chip label={r.action} size="small" variant="outlined" /></TableCell>
                <TableCell>
                  {r.entityType}{r.entityId ? ` · ${r.entityId.slice(0, 8)}` : ''}
                </TableCell>
                <TableCell sx={{ maxWidth: 300 }}>
                  <Typography variant="caption" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {r.metadata ? JSON.stringify(r.metadata) : '—'}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={5} align="center">No audit logs found{logs.isLoading ? '…' : ''}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}
