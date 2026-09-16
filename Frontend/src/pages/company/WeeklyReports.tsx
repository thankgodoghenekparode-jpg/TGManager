import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
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
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import DownloadIcon from '@mui/icons-material/Download'
import FilePresentIcon from '@mui/icons-material/FilePresent'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { weeklyReportsApi, type ReportStatus, type WeeklyReport } from '../../api/weeklyReports'
import { documentsApi, type DocRecord } from '../../api/documents'
import { apiErrorMessage } from '../../api/client'
import { Can, useCan } from '../../components/PermissionGate'
import { saveBlob } from '../../lib/download'

export function WeeklyReportsPage() {
  const qc = useQueryClient()
  const canManage = useCan('report.manage')
  const [tab, setTab] = useState(0)
  const [month, setMonth] = useState(() => dayjs().format('YYYY-MM'))
  const [searchDate, setSearchDate] = useState('')
  const [editing, setEditing] = useState<WeeklyReport | null>(null)
  const [creating, setCreating] = useState(false)
  const [viewing, setViewing] = useState<WeeklyReport | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<WeeklyReport | null>(null)

  const mine = useQuery({ queryKey: ['weekly-reports', 'mine'], queryFn: () => weeklyReportsApi.myReports() })
  const all = useQuery({
    queryKey: ['weekly-reports', 'all'],
    queryFn: () => weeklyReportsApi.allReports(),
    enabled: canManage,
  })

  const rows = (() => {
    const result = tab === 1 && canManage ? (all.data ?? []) : (mine.data ?? [])
    if (searchDate) return result.filter((r) => r.weekStart === searchDate)
    if (month) return result.filter((r) => r.weekStart.slice(0, 7) === month)
    return result
  })()

  const invalidate = () => qc.invalidateQueries({ queryKey: ['weekly-reports'] })

  const review = useMutation({
    mutationFn: (r: WeeklyReport) =>
      weeklyReportsApi.setStatus(r.id, r.status === 'REVIEWED' ? 'SUBMITTED' : 'REVIEWED'),
    onSuccess: () => { setViewing(null); invalidate() },
  })

  const remove = useMutation({
    mutationFn: (id: string) => weeklyReportsApi.remove(id),
    onSuccess: () => { setConfirmDelete(null); invalidate() },
  })

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" fontWeight={800}>Weekly Reports</Typography>
        <Can permissions={['report.submit']}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating(true)}>
            Submit report
          </Button>
        </Can>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Submit or upload your reports for each working week and track reviews.
      </Typography>

      {canManage && (
        <Tabs value={tab} onChange={(_, v) => setTab(v as number)} sx={{ mb: 2 }}>
          <Tab label="My reports" />
          <Tab label="All reports" />
        </Tabs>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }} alignItems="center">
        <TextField
          select
          label="Filter by week start month"
          value={month}
          onChange={(e) => { setMonth(e.target.value); setSearchDate('') }}
          size="small"
          sx={{ minWidth: 220, width: { xs: '100%', sm: 'auto' } }}
        >
          <MenuItem value="">All months</MenuItem>
          {monthOptions(tab === 1 && canManage ? (all.data ?? []) : (mine.data ?? [])).map((m) => (
            <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
          ))}
        </TextField>
        <TextField
          label="Search by exact week start date"
          type="date"
          value={searchDate}
          onChange={(e) => { setSearchDate(e.target.value); if (e.target.value) setMonth('') }}
          size="small"
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 220, width: { xs: '100%', sm: 'auto' } }}
        />
        <Box sx={{ flex: 1 }} />
        {(month || searchDate) && (
          <Button size="small" onClick={() => { setMonth(''); setSearchDate('') }}>
            Clear filter
          </Button>
        )}
      </Stack>

      {(mine.isLoading || (canManage && all.isLoading)) && (
        <Alert severity="info" sx={{ mb: 2 }}>Loading reports…</Alert>
      )}
      {remove.error && <Alert severity="error" sx={{ mb: 2 }}>{apiErrorMessage(remove.error)}</Alert>}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Week</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Attachments</TableCell>
              <TableCell>Notes</TableCell>
              {tab === 1 && canManage && <TableCell>Submitted by</TableCell>}
              <TableCell>Submitted</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{weekRange(r.weekStart, r.weekEnd)}</TableCell>
                <TableCell><StatusChip status={r.status} /></TableCell>
                <TableCell>{r.attachments.length}</TableCell>
                <TableCell sx={{ maxWidth: 260 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.notes || '—'}
                  </Typography>
                </TableCell>
                {tab === 1 && canManage && (
                  <TableCell>{r.submittedBy ? `${r.submittedBy.firstName} ${r.submittedBy.lastName}` : '—'}</TableCell>
                )}
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{dayjs(r.createdAt).format('MMM D, YYYY')}</TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  <IconButton title="View" onClick={() => setViewing(r)}><VisibilityIcon fontSize="small" /></IconButton>
                  <Can permissions={['report.submit']}>
                    <IconButton title="Delete" color="error" onClick={() => setConfirmDelete(r)}><DeleteIcon fontSize="small" /></IconButton>
                  </Can>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={tab === 1 && canManage ? 7 : 6} align="center">No reports yet</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {creating && (
        <ReportDialog
          onClose={() => setCreating(false)}
          onDone={() => { setCreating(false); invalidate() }}
        />
      )}

      {editing && (
        <ReportDialog
          report={editing}
          onClose={() => setEditing(null)}
          onDone={() => { setEditing(null); invalidate() }}
        />
      )}

      <Dialog open={viewing !== null} onClose={() => setViewing(null)} fullWidth maxWidth="sm">
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <span>Weekly report</span>
            {viewing && <StatusChip status={viewing.status} />}
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {viewing && (
            <Stack spacing={2}>
              <Box>
                <Typography variant="overline" color="text.secondary">Week</Typography>
                <Typography variant="body1" fontWeight={600}>{weekRange(viewing.weekStart, viewing.weekEnd)}</Typography>
              </Box>
              <Box>
                <Typography variant="overline" color="text.secondary">Submitted by</Typography>
                <Typography variant="body1">{viewing.submittedBy ? `${viewing.submittedBy.firstName} ${viewing.submittedBy.lastName}` : '—'}</Typography>
              </Box>
              <Box>
                <Typography variant="overline" color="text.secondary">Notes</Typography>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{viewing.notes || 'No notes.'}</Typography>
              </Box>
              <Box>
                <Typography variant="overline" color="text.secondary">Attachments</Typography>
                <Stack spacing={1} sx={{ mt: 0.5 }}>
                  {viewing.attachments.map((a) => (
                    <Stack key={a.id} direction="row" alignItems="center" spacing={1}>
                      <FilePresentIcon fontSize="small" color="action" />
                      <Typography variant="body2" sx={{ flex: 1 }}>{a.title}</Typography>
                      <IconButton
                        title="Download"
                        onClick={() => {
                          void documentsApi.download(a.id).then((blob) => saveBlob(blob, a.title))
                        }}
                      >
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  ))}
                  {viewing.attachments.length === 0 && <Typography variant="body2" color="text.secondary">No attachments.</Typography>}
                </Stack>
              </Box>
              {viewing.reviewedAt && (
                <Box>
                  <Typography variant="overline" color="text.secondary">Reviewed</Typography>
                  <Typography variant="body2">
                    {dayjs(viewing.reviewedAt).format('MMM D, YYYY h:mm A')}
                    {viewing.reviewedBy ? ` by ${viewing.reviewedBy.firstName} ${viewing.reviewedBy.lastName}` : ''}
                  </Typography>
                </Box>
              )}
              {canManage && viewing.status === 'SUBMITTED' && (
                <Alert severity="info">This report is awaiting review.</Alert>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          {viewing && canManage && viewing.status === 'SUBMITTED' && (
            <Button color="success" disabled={review.isPending} onClick={() => review.mutate(viewing)}>
              Mark reviewed
            </Button>
          )}
          <Can permissions={['report.submit']}>
            {viewing && <Button onClick={() => { setEditing(viewing); setViewing(null) }}>Edit</Button>}
          </Can>
          <Button onClick={() => setViewing(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmDelete !== null} onClose={() => setConfirmDelete(null)}>
        <DialogTitle>Delete weekly report</DialogTitle>
        <DialogContent>Delete the report for {confirmDelete ? weekRange(confirmDelete.weekStart, confirmDelete.weekEnd) : ''}?</DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button color="error" disabled={remove.isPending} onClick={() => confirmDelete && remove.mutate(confirmDelete.id)}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

function StatusChip({ status }: { status: ReportStatus }) {
  return (
    <Chip
      size="small"
      label={status === 'REVIEWED' ? 'Reviewed' : 'Submitted'}
      color={status === 'REVIEWED' ? 'success' : 'default'}
      variant={status === 'REVIEWED' ? 'filled' : 'outlined'}
    />
  )
}

function ReportDialog({
  report,
  onClose,
  onDone,
}: {
  report?: WeeklyReport
  onClose: () => void
  onDone: () => void
}) {
  const isEdit = report !== undefined
  const [weekStart, setWeekStart] = useState(isEdit ? report.weekStart.slice(0, 10) : mondayOfThisWeek())
  const [notes, setNotes] = useState(report?.notes ?? '')
  const [attached, setAttached] = useState<Array<{ id: string; title: string }>>(
    report?.attachments.map((a) => ({ id: a.id, title: a.title })) ?? [],
  )
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement | null>(null)

  const save = useMutation({
    mutationFn: (body: { weekStart: string; notes: string | null; attachmentIds: string[] }) =>
      isEdit && report ? weeklyReportsApi.update(report.id, body) : weeklyReportsApi.submit(body),
    onSuccess: onDone,
    onError: (e) => setError(apiErrorMessage(e)),
  })

  const uploadFile = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append('file', file)
      form.append('title', file.name)
      form.append('type', 'GENERAL')
      return documentsApi.create(form)
    },
    onSuccess: (doc: DocRecord) => {
      setAttached((prev) => [...prev, { id: doc.id, title: doc.title }])
      if (fileRef.current) fileRef.current.value = ''
    },
    onError: (e) => setError(apiErrorMessage(e)),
  })

  const pickFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : []
    files.forEach((f) => uploadFile.mutate(f))
  }

  const submit = () => {
    if (!weekStart) { setError('Choose the report week start date.'); return }
    save.mutate({ weekStart, notes: notes.trim() || null, attachmentIds: attached.map((a) => a.id) })
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{isEdit ? 'Edit weekly report' : 'Submit weekly report'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="Week start date"
            type="date"
            value={weekStart}
            onChange={(e) => setWeekStart(e.target.value)}
            disabled={isEdit}
            fullWidth
          />
          <TextField
            label="Notes"
            multiline
            minRows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Achievements, challenges, resource needs…"
            fullWidth
          />
          <Button variant="outlined" component="label" startIcon={<UploadFileIcon />}>
            Attach files
            <input ref={fileRef} type="file" multiple hidden onChange={pickFiles} />
          </Button>
          {attached.length > 0 && (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableBody>
                  {attached.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <FilePresentIcon fontSize="small" color="action" />
                          <Typography variant="body2" sx={{ flex: 1 }}>{a.title}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" color="error" onClick={() => setAttached((prev) => prev.filter((x) => x.id !== a.id))}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={save.isPending || uploadFile.isPending} onClick={submit}>
          {isEdit ? 'Save changes' : 'Submit report'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function mondayOfThisWeek(): string {
  return dayjs().startOf('week').add(1, 'day').format('YYYY-MM-DD')
}

/** Distinct YYYY-MM month options derived from the report week-start dates, newest first. */
function monthOptions(reports: WeeklyReport[]): Array<{ value: string; label: string }> {
  const months = new Map<string, number>()
  for (const r of reports) {
    const key = r.weekStart.slice(0, 7)
    if (!months.has(key)) months.set(key, 0)
    months.set(key, (months.get(key) ?? 0) + 1)
  }
  return [...months.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([value, count]) => ({
      value,
      label: `${dayjs(value + '-01').format('MMMM YYYY')} (${count})`,
    }))
}

function weekRange(weekStart: string, weekEnd: string): string {
  const sameYear = dayjs(weekStart).year() === dayjs(weekEnd).year()
  const from = dayjs(weekStart).format(sameYear ? 'MMM D' : 'MMM D, YYYY')
  const to = dayjs(weekEnd).format('MMM D, YYYY')
  return `${from} – ${to}`
}
