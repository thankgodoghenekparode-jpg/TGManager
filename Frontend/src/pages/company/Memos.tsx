import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import PublishIcon from '@mui/icons-material/Publish'
import ReadMoreIcon from '@mui/icons-material/ReadMore'
import { memosApi, type Memo, type MemoAudience } from '../../api/memos'
import { branchesApi } from '../../api/branches'
import { departmentsApi } from '../../api/departments'
import { groupsApi } from '../../api/groups'
import { staffApi } from '../../api/staff'
import { apiErrorMessage } from '../../api/client'
import { useAuthStore } from '../../store/auth'
import { Can } from '../../components/PermissionGate'

type RecipientType = 'ALL' | 'BRANCH' | 'DEPARTMENT' | 'GROUP' | 'STAFF'

interface Option {
  id: string
  name: string
}

const RECIPIENT_LABELS: Record<RecipientType, string> = {
  ALL: 'All staff',
  BRANCH: 'Branch(es)',
  DEPARTMENT: 'Department(s)',
  GROUP: 'Group(s)',
  STAFF: 'Individual staff',
}

export function MemosPage() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Memo | null>(null)
  const [creating, setCreating] = useState(false)
  const [viewing, setViewing] = useState<Memo | null>(null)
  const [confirm, setConfirm] = useState<Memo | null>(null)
  const [branchFilter, setBranchFilter] = useState('')
  const [notice, setNotice] = useState('')

  const branches = useQuery({ queryKey: ['branches'], queryFn: () => branchesApi.list() })
  const departments = useQuery({ queryKey: ['departments'], queryFn: () => departmentsApi.list() })
  const groups = useQuery({ queryKey: ['groups'], queryFn: () => groupsApi.list() })
  const staff = useQuery({ queryKey: ['staff'], queryFn: () => staffApi.list() })
  const memos = useQuery({
    queryKey: ['memos', branchFilter],
    queryFn: () => memosApi.list({ branchId: branchFilter || undefined }),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['memos'] })

  const flash = (msg: string) => {
    setNotice(msg)
    window.setTimeout(() => setNotice(''), 3000)
  }

  const save = useMutation({
    mutationFn: (body: { subject: string; body: string; through?: string | null; audience?: MemoAudience; publish?: boolean }) =>
      editing
        ? memosApi.update(editing.id, {
            title: body.subject,
            body: body.body,
            through: body.through ?? null,
            audience: body.audience,
          })
        : memosApi.create({
            title: body.subject,
            body: body.body,
            through: body.through ?? null,
            audience: body.audience,
            publish: body.publish,
          }),
    onSuccess: () => { setCreating(false); setEditing(null); invalidate(); flash('Memo saved.') },
  })

  const publish = useMutation({
    mutationFn: (id: string) => memosApi.publish(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['memos'] }); qc.invalidateQueries({ queryKey: ['notifications'] }); flash('Memo published.') },
  })

  const remove = useMutation({
    mutationFn: (id: string) => memosApi.remove(id),
    onSuccess: () => { setConfirm(null); invalidate(); flash('Memo deleted.') },
  })

  const rows = memos.data ?? []

  const openMemo = (m: Memo) => {
    setViewing(m)
    if (!m.read) void memosApi.markRead(m.id).then(() => qc.invalidateQueries({ queryKey: ['memos'] }))
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" fontWeight={700}>Memos</Typography>
        <Can permissions={['memo.create']}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditing(null); setCreating(true) }}>
            New memo
          </Button>
        </Can>
      </Stack>

      <TextField select label="Filter by branch" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} size="small" sx={{ mb: 2, minWidth: 220, width: { xs: '100%', sm: 'auto' } }}>
        <MenuItem value="">All branches</MenuItem>
        {(branches.data ?? []).map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
      </TextField>

      {notice && <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert>}

      {(save.error || remove.error || publish.error) && (
        <Alert severity="error" sx={{ mb: 2 }}>{apiErrorMessage(save.error ?? remove.error ?? publish.error)}</Alert>
      )}

      <Grid container spacing={2}>
        {rows.map((m) => (
          <Grid item xs={12} md={6} key={m.id}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1, flexWrap: 'wrap', gap: 1 }}>
                  <Typography variant="overline" fontWeight={800} letterSpacing="0.12em" color={m.publishedAt && !m.read ? 'primary' : 'text.secondary'}>
                    Memorandum
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                    {m.publishedAt && !m.read && <Chip label="New" size="small" color="primary" variant="outlined" />}
                    <Chip
                      label={m.publishedAt ? 'Published' : 'Draft'}
                      size="small"
                      color={m.publishedAt ? 'success' : 'default'}
                    />
                  </Stack>
                </Stack>
                <Divider />
                <Box sx={{ py: 1.5 }}>
          <MemoField label="TO:" value={audienceLabel(m, branches.data ?? [], departments.data ?? [], groups.data ?? [], staff.data ?? [])} bold={false} />
          <MemoField label="THROUGH:" value={m.through ?? '—'} />
          <MemoField label="FROM:" value={senderName(m)} />
                  <MemoField label="SUBJECT:" value={m.title} bold={Boolean(m.publishedAt && !m.read)} />
                  <MemoField label="DATE:" value={formatMemoDate(m.publishedAt ?? m.createdAt)} />
                </Box>
                <Divider />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, whiteSpace: 'pre-wrap' }}>
                  {m.body.length > 200 ? `${m.body.slice(0, 200)}…` : m.body}
                </Typography>
              </CardContent>
              <CardActions sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
                <Button size="small" startIcon={<ReadMoreIcon />} onClick={() => openMemo(m)}>Read</Button>
                <Box sx={{ flex: 1 }} />
                <Can permissions={['memo.manage']}>
                  {!m.publishedAt && (
                    <Button size="small" startIcon={<PublishIcon />} onClick={() => publish.mutate(m.id)}>Publish</Button>
                  )}
                  <IconButton size="small" onClick={() => { setEditing(m); setCreating(true) }}><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" color="error" onClick={() => setConfirm(m)}><DeleteIcon fontSize="small" /></IconButton>
                </Can>
              </CardActions>
            </Card>
          </Grid>
        ))}
        {rows.length === 0 && <Grid item xs={12}><Typography color="text.secondary" align="center">No memos</Typography></Grid>}
      </Grid>

      {(creating || editing) && (
        <MemoDialog
          memo={editing}
          open
          branchOptions={(branches.data ?? []).map((b) => ({ id: b.id, name: b.name }))}
          departmentOptions={(departments.data ?? []).map((d) => ({ id: d.id, name: d.name }))}
          groupOptions={(groups.data ?? []).map((g) => ({ id: g.id, name: g.name }))}
          staffOptions={(staff.data ?? []).map((s) => ({ id: s.user.id, name: `${s.user.firstName} ${s.user.lastName}` }))}
          senderName={(editing?.createdByUser ? `${editing.createdByUser.firstName} ${editing.createdByUser.lastName}` : undefined) ?? currentUserName()}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSave={(body) => save.mutate(body)}
          busy={save.isPending}
        />
      )}

      {viewing && (
        <MemoViewDialog
          memo={viewing}
          toLabel={audienceLabel(viewing, branches.data ?? [], departments.data ?? [], groups.data ?? [], staff.data ?? [])}
          onClose={() => setViewing(null)}
        />
      )}

      <Dialog open={confirm !== null} onClose={() => setConfirm(null)}>
        <DialogTitle>Delete memo</DialogTitle>
        <DialogContent>Delete "{confirm?.title}"?</DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>Cancel</Button>
          <Button color="error" onClick={() => confirm && remove.mutate(confirm.id)}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

function MemoField({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <Stack direction="row" spacing={{ xs: 0.5, sm: 1 }} alignItems="flex-start" sx={{ py: 0.25 }}>
      <Typography variant="body2" fontWeight={800} sx={{ minWidth: { xs: 62, sm: 76 }, flexShrink: 0 }}>{label}</Typography>
      <Typography variant="body2" fontWeight={bold ? 700 : 400} sx={{ overflowWrap: 'anywhere' }}>{value}</Typography>
    </Stack>
  )
}

function MemoDialog({
  memo,
  open,
  branchOptions,
  departmentOptions,
  groupOptions,
  staffOptions,
  senderName,
  onClose,
  onSave,
  busy,
}: {
  memo: Memo | null
  open: boolean
  branchOptions: Option[]
  departmentOptions: Option[]
  groupOptions: Option[]
  staffOptions: Option[]
  senderName: string
  onClose: () => void
  onSave: (body: { subject: string; body: string; through?: string | null; audience?: MemoAudience; publish?: boolean }) => void
  busy: boolean
}) {
  const init = audienceToState(memo?.audience)
  const [subject, setSubject] = useState(memo?.title ?? '')
  const [body, setBody] = useState(memo?.body ?? '')
  const [through, setThrough] = useState(memo?.through ?? '')
  const [recipientType, setRecipientType] = useState<RecipientType>(init.type)
  const [selectedIds, setSelectedIds] = useState<string[]>(init.ids)
  const [publish, setPublish] = useState(false)

  const optionsFor =
    recipientType === 'BRANCH' ? branchOptions
    : recipientType === 'DEPARTMENT' ? departmentOptions
    : recipientType === 'GROUP' ? groupOptions
    : recipientType === 'STAFF' ? staffOptions
    : []

  const recipientLabel = () => {
    if (recipientType === 'ALL') return 'All staff'
    const names = selectedIds.map((id) => optionsFor.find((o) => o.id === id)?.name ?? id)
    return names.join(', ') || 'Select recipients…'
  }

  const confirmDisabled =
    busy || !subject.trim() || !body.trim() || (recipientType !== 'ALL' && selectedIds.length === 0)

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{memo ? 'Edit memo' : 'New memo'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            select
            label="TO:"
            value={recipientType}
            onChange={(e) => { setRecipientType(e.target.value as RecipientType); setSelectedIds([]) }}
            fullWidth
            disabled={!!memo?.publishedAt}
          >
            {(Object.keys(RECIPIENT_LABELS) as RecipientType[]).map((t) => (
              <MenuItem key={t} value={t}>{RECIPIENT_LABELS[t]}</MenuItem>
            ))}
          </TextField>
          {recipientType !== 'ALL' && (
            <TextField
              select
              SelectProps={{ multiple: true }}
              label="Select recipients"
              value={selectedIds}
              onChange={(e) => setSelectedIds(typeof e.target.value === 'string' ? [e.target.value] : e.target.value)}
              fullWidth
              helperText={`To: ${recipientLabel()}`}
              disabled={!!memo?.publishedAt}
            >
              {optionsFor.map((o) => <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>)}
            </TextField>
          )}
          {recipientType === 'ALL' && (
            <Typography variant="caption" color="text.secondary">To: All staff</Typography>
          )}
          <TextField
            label="THROUGH:"
            value={through}
            onChange={(e) => setThrough(e.target.value)}
            fullWidth
            placeholder="e.g. Operations Manager"
            helperText="Who this memo passes through (optional)"
          />
          <TextField label="FROM:" value={senderName} disabled fullWidth />
          <TextField label="SUBJECT:" value={subject} onChange={(e) => setSubject(e.target.value)} fullWidth autoFocus />
          <TextField
            label="DATE:"
            value={formatMemoDate(memo?.publishedAt ?? memo?.createdAt ?? new Date().toISOString())}
            disabled
            fullWidth
          />
          <TextField label="Message body" value={body} onChange={(e) => setBody(e.target.value)} fullWidth multiline minRows={4} />
          {!memo && (
            <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={0.5}>
              <Typography variant="body2">Publish now</Typography>
              <Switch checked={publish} onChange={(e) => setPublish(e.target.checked)} />
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={confirmDisabled}
          onClick={() => onSave({
            subject: subject.trim(),
            body: body.trim(),
            through: through.trim() || null,
            audience: buildAudience(recipientType, selectedIds),
            publish,
          })}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function MemoViewDialog({ memo, toLabel, onClose }: { memo: Memo; toLabel: string; onClose: () => void }) {
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Memo</DialogTitle>
      <DialogContent>
        <Stack spacing={1}>
          <Typography variant="overline" fontWeight={800} letterSpacing="0.12em" color="text.secondary">
            Memorandum · {memo.publishedAt ? 'Published' : 'Draft'}
          </Typography>
          <Divider />
          <MemoField label="TO:" value={toLabel} />
          <MemoField label="THROUGH:" value={memo.through ?? '—'} />
          <MemoField label="FROM:" value={senderName(memo)} />
          <MemoField label="SUBJECT:" value={memo.title} bold />
          <MemoField label="DATE:" value={formatMemoDate(memo.publishedAt ?? memo.createdAt)} />
          <Divider />
          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', pt: 1 }}>{memo.body}</Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}

function audienceToState(a: MemoAudience | undefined): { type: RecipientType; ids: string[] } {
  if (a?.branchIds?.length) return { type: 'BRANCH', ids: a.branchIds }
  if (a?.departmentIds?.length) return { type: 'DEPARTMENT', ids: a.departmentIds }
  if (a?.groupIds?.length) return { type: 'GROUP', ids: a.groupIds }
  if (a?.userIds?.length) return { type: 'STAFF', ids: a.userIds }
  return { type: 'ALL', ids: [] }
}

function buildAudience(type: RecipientType, ids: string[]): MemoAudience {
  if (type === 'BRANCH') return { branchIds: ids }
  if (type === 'DEPARTMENT') return { departmentIds: ids }
  if (type === 'GROUP') return { groupIds: ids }
  if (type === 'STAFF') return { userIds: ids }
  return { all: true }
}

function senderName(m: Memo): string {
  const u = m.createdByUser ?? m.createdBy
  return u ? `${u.firstName} ${u.lastName}` : m.createdByUserId
}

function audienceLabel(
  m: Memo,
  branches: Array<{ id: string; name: string }>,
  departments: Array<{ id: string; name: string }>,
  groups: Array<{ id: string; name: string }>,
  staff: Array<{ id: string; user: { id: string; firstName: string; lastName: string } }>,
): string {
  const a = m.audience ?? {}
  const name = (id: string): string => {
    const b = branches.find((x) => x.id === id)
    if (b) return b.name
    const d = departments.find((x) => x.id === id)
    if (d) return d.name
    const g = groups.find((x) => x.id === id)
    if (g) return g.name
    const s = staff.find((x) => x.user.id === id)
    if (s) return `${s.user.firstName} ${s.user.lastName}`.trim()
    return id
  }
  const parts: string[] = []
  if (a.branchIds?.length) parts.push(...a.branchIds.map((id) => `Staff at ${name(id)}`))
  if (a.departmentIds?.length) parts.push(...a.departmentIds.map((id) => `Department: ${name(id)}`))
  if (a.groupIds?.length) parts.push(...a.groupIds.map((id) => `Group: ${name(id)}`))
  if (a.userIds?.length) parts.push(...a.userIds.map((id) => name(id)))
  if (a.all) return 'All staff'
  return parts.join(', ') || (m.branchId ? `Staff at ${branches.find((b) => b.id === m.branchId)?.name ?? m.branchId}` : 'All staff')
}

function formatMemoDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' })
}

let cachedCurrentUserName: string | null = null

function currentUserName(): string {
  if (cachedCurrentUserName) return cachedCurrentUserName
  const user = useAuthStore.getState().user
  cachedCurrentUserName = user ? `${user.firstName} ${user.lastName}` : ''
  return cachedCurrentUserName ?? ''
}
