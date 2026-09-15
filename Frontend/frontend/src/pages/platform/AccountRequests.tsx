import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import BlockIcon from '@mui/icons-material/Block'
import VisibilityIcon from '@mui/icons-material/Visibility'
import type {
  AccountRequestStatus,
  EmailChangeRequest,
  PasswordResetRequest,
} from '../../api/accountRequests'
import { accountRequestsApi } from '../../api/accountRequests'
import { apiErrorMessage } from '../../api/client'
import { useAuthStore } from '../../store/auth'

type TabKey = 'email-change' | 'password-reset'

const STATUS_COLOR: Record<AccountRequestStatus, 'default' | 'info' | 'success' | 'error'> = {
  PENDING: 'info',
  APPROVED: 'success',
  REJECTED: 'error',
  COMPLETED: 'success',
}

const SUPER_ADMIN = 'SUPER_ADMIN'

export function AccountRequestsPage() {
  const qc = useQueryClient()
  const me = useAuthStore((s) => s.user)
  const isSuper = me?.role === SUPER_ADMIN
  const [tab, setTab] = useState<TabKey>('email-change')

  const [view, setView] = useState<EmailChangeRequest | PasswordResetRequest | null>(null)
  const [approveTarget, setApproveTarget] = useState<EmailChangeRequest | PasswordResetRequest | null>(null)
  const [rejectTarget, setRejectTarget] = useState<EmailChangeRequest | PasswordResetRequest | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [resetResult, setResetResult] = useState<{ message: string; temporaryPassword?: string } | null>(null)
  const [error, setError] = useState('')

  const summary = useQuery({
    queryKey: ['admin', 'account-requests', 'summary'],
    queryFn: () => accountRequestsApi.summary(),
  })

  const emailChanges = useQuery({
    queryKey: ['admin', 'account-requests', 'email-change'],
    queryFn: () => accountRequestsApi.emailChanges(),
  })

  const passwordResets = useQuery({
    queryKey: ['admin', 'account-requests', 'password-reset'],
    queryFn: () => accountRequestsApi.passwordResets(),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'account-requests'] })
  }

  const approveEmail = useMutation({
    mutationFn: (id: string) => accountRequestsApi.approveEmailChange(id),
    onSuccess: () => {
      setApproveTarget(null)
      invalidate()
    },
    onError: (e) => setError(apiErrorMessage(e)),
  })

  const rejectEmail = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => accountRequestsApi.rejectEmailChange(id, note || undefined),
    onSuccess: () => {
      setRejectTarget(null)
      setRejectNote('')
      invalidate()
    },
    onError: (e) => setError(apiErrorMessage(e)),
  })

  const approvePassword = useMutation({
    mutationFn: (id: string) => accountRequestsApi.approvePasswordReset(id),
    onSuccess: (res) => {
      setApproveTarget(null)
      setResetResult(res)
      invalidate()
    },
    onError: (e) => setError(apiErrorMessage(e)),
  })

  const rejectPassword = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => accountRequestsApi.rejectPasswordReset(id, note || undefined),
    onSuccess: () => {
      setRejectTarget(null)
      setRejectNote('')
      invalidate()
    },
    onError: (e) => setError(apiErrorMessage(e)),
  })

  const summaryData = summary.data
  const emailRows = emailChanges.data?.items ?? []
  const passwordRows = passwordResets.data?.items ?? []

  const isEmail = (r: EmailChangeRequest | PasswordResetRequest): r is EmailChangeRequest =>
    'requestedEmail' in r

  const openView = (r: EmailChangeRequest | PasswordResetRequest) => setView(r)

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>Account Requests</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Review and process customer email change and password reset requests.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <Card variant="outlined" sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="h4" fontWeight={800}>{summaryData?.pendingEmailChanges ?? '—'}</Typography>
            <Typography variant="body2" color="text.secondary">Pending Email Changes</Typography>
          </CardContent>
        </Card>
        <Card variant="outlined" sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="h4" fontWeight={800}>{summaryData?.pendingPasswordResets ?? '—'}</Typography>
            <Typography variant="body2" color="text.secondary">Pending Password Resets</Typography>
          </CardContent>
        </Card>
        <Card variant="outlined" sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="h4" fontWeight={800}>{summaryData?.totalPending ?? '—'}</Typography>
            <Typography variant="body2" color="text.secondary">Total Pending Requests</Typography>
          </CardContent>
        </Card>
      </Stack>

      <Paper variant="outlined">
        <Tabs value={tab} onChange={(_, v: TabKey) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Email Change Requests" value="email-change" />
          <Tab label="Password Reset Requests" value="password-reset" />
        </Tabs>

        {tab === 'email-change' && (
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Request ID</TableCell>
                  <TableCell>Customer</TableCell>
                  <TableCell>Current Email</TableCell>
                  <TableCell>Requested Email</TableCell>
                  <TableCell>Reason</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {emailRows.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{r.id}</TableCell>
                    <TableCell>{r.user.firstName} {r.user.lastName}</TableCell>
                    <TableCell>{r.currentEmail}</TableCell>
                    <TableCell>{r.requestedEmail}</TableCell>
                    <TableCell>{r.reason ?? '—'}</TableCell>
                    <TableCell>{new Date(r.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell><Chip label={r.status} size="small" color={STATUS_COLOR[r.status]} /></TableCell>
                    <TableCell align="right">
                      <Actions
                        isSuper={isSuper}
                        status={r.status}
                        onView={() => openView(r)}
                        onApprove={() => setApproveTarget(r)}
                        onReject={() => { setRejectNote(''); setRejectTarget(r) }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {emailRows.length === 0 && (
                  <TableRow><TableCell colSpan={8} align="center">No email change requests found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {tab === 'password-reset' && (
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Request ID</TableCell>
                  <TableCell>Customer</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {passwordRows.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{r.id}</TableCell>
                    <TableCell>{r.user.firstName} {r.user.lastName}</TableCell>
                    <TableCell>{r.email}</TableCell>
                    <TableCell>{new Date(r.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell><Chip label={r.status} size="small" color={STATUS_COLOR[r.status]} /></TableCell>
                    <TableCell align="right">
                      <Actions
                        isSuper={isSuper}
                        status={r.status}
                        onView={() => openView(r)}
                        onApprove={() => setApproveTarget(r)}
                        onReject={() => { setRejectNote(''); setRejectTarget(r) }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {passwordRows.length === 0 && (
                  <TableRow><TableCell colSpan={6} align="center">No password reset requests found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {approveTarget && isEmail(approveTarget) ? (
        <ApprovalModal
          title="Approve Email Change?"
          kind="email"
          busy={approveEmail.isPending}
          onCancel={() => setApproveTarget(null)}
          onConfirm={() => approveEmail.mutate(approveTarget.id)}
        >
          <DetailRow label="Customer" value={`${approveTarget.user.firstName} ${approveTarget.user.lastName}`} />
          <DetailRow label="Current Email" value={approveTarget.currentEmail} />
          <DetailRow label="New Email" value={approveTarget.requestedEmail} />
        </ApprovalModal>
      ) : approveTarget && isEmail(approveTarget) === false ? (
        <ApprovalModal
          title="Approve Password Reset?"
          kind="password"
          busy={approvePassword.isPending}
          onCancel={() => setApproveTarget(null)}
          onConfirm={() => approvePassword.mutate(approveTarget.id)}
        >
          <DetailRow label="Customer" value={`${approveTarget.user.firstName} ${approveTarget.user.lastName}`} />
          <DetailRow label="Email" value={approveTarget.email} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            A secure temporary password will be generated and shown once. The customer's current sessions will be revoked.
          </Typography>
        </ApprovalModal>
      ) : null}

      {rejectTarget && (
        <Dialog open onClose={() => setRejectTarget(null)} fullWidth maxWidth="xs">
          <DialogTitle>
            {rejectTarget && 'requestedEmail' in rejectTarget
              ? 'Reject Email Change Request'
              : 'Reject Password Reset Request'}
          </DialogTitle>
          <DialogContent sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 1.5, sm: 2 } }}>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <TextField
                label="Reason"
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                fullWidth
                multiline
                minRows={2}
                autoFocus
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 2 }, flexWrap: 'wrap' }}>
            <Button onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button
              color="error"
              startIcon={<BlockIcon />}
              onClick={() => {
                if ('requestedEmail' in rejectTarget) {
                  rejectEmail.mutate({ id: rejectTarget.id, note: rejectNote })
                } else {
                  rejectPassword.mutate({ id: rejectTarget.id, note: rejectNote })
                }
              }}
              disabled={rejectEmail.isPending || rejectPassword.isPending}
            >
              Reject Request
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {view && (
        <Dialog open onClose={() => setView(null)} fullWidth maxWidth="sm">
          <DialogTitle>Request Details</DialogTitle>
          <DialogContent sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 1.5, sm: 2 } }}>
            <Stack spacing={1}>
              <DetailRow label="Request ID" value={view.id} mono />
              <DetailRow label="Customer" value={`${view.user.firstName} ${view.user.lastName} (${view.user.email})`} />
              {'currentEmail' in view && <DetailRow label="Current Email" value={view.currentEmail} />}
              {'requestedEmail' in view && <DetailRow label="Requested Email" value={view.requestedEmail} />}
              {'reason' in view && <DetailRow label="Reason" value={view.reason ?? '—'} />}
              <DetailRow label="Status" value={view.status} />
              <DetailRow label="Submitted" value={new Date(view.createdAt).toLocaleString()} />
              {view.adminNote && <DetailRow label="Admin Note" value={view.adminNote} />}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 2 }, flexWrap: 'wrap' }}>
            <Button onClick={() => setView(null)}>Close</Button>
          </DialogActions>
        </Dialog>
      )}

      {resetResult && (
        <Dialog open onClose={() => setResetResult(null)} fullWidth maxWidth="sm">
          <DialogTitle>Password Reset Completed</DialogTitle>
          <DialogContent sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 1.5, sm: 2 } }}>
            <Alert severity="success" sx={{ mb: 2 }}>{resetResult.message}</Alert>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Share this one-time temporary password securely with the customer. It will not be shown again.
            </Typography>
            <Alert severity="warning">
              <strong>{resetResult.temporaryPassword}</strong>
            </Alert>
          </DialogContent>
          <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 2 }, flexWrap: 'wrap' }}>
            <Button onClick={() => setResetResult(null)}>Close</Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  )
}

function Actions({
  isSuper,
  status,
  onView,
  onApprove,
  onReject,
}: {
  isSuper: boolean
  status: AccountRequestStatus
  onView: () => void
  onApprove: () => void
  onReject: () => void
}) {
  const canAct = isSuper && status === 'PENDING'
  return (
    <Stack direction="row" spacing={0.5} justifyContent="flex-end" sx={{ flexWrap: 'wrap' }}>
      <Button size="small" startIcon={<VisibilityIcon fontSize="small" />} onClick={onView}>View</Button>
      {canAct && (
        <>
          <Button size="small" color="success" startIcon={<CheckCircleIcon fontSize="small" />} onClick={onApprove}>Approve</Button>
          <Button size="small" color="error" startIcon={<BlockIcon fontSize="small" />} onClick={onReject}>Reject</Button>
        </>
      )}
    </Stack>
  )
}

function ApprovalModal({
  title,
  kind,
  busy,
  onCancel,
  onConfirm,
  children,
}: {
  title: string
  kind: 'email' | 'password'
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
  children: React.ReactNode
}) {
  return (
    <Dialog open onClose={onCancel} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={1}>{children}</Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button
          color="success"
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <CheckCircleIcon />}
          onClick={onConfirm}
          disabled={busy}
        >
          {kind === 'email' ? 'Approve' : 'Approve Reset'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function DetailRow({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={600} sx={mono ? { fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' } : { wordBreak: 'break-word' }}>
        {value ?? '—'}
      </Typography>
    </Box>
  )
}
