import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  Switch,
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
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import LinkIcon from '@mui/icons-material/Link'
import PublishIcon from '@mui/icons-material/Publish'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { formsApi, isRoleSection, ROLE_SECTION_KEYS, type FormDef, type FormField, type FormFieldType, type FormSubmission } from '../../api/forms'
import { branchesApi } from '../../api/branches'
import { isChildFormDef } from '../../lib/childForms'
import { FormFieldInput } from '../../components/FormFields'
import { CustomerTicketPicker } from '../../components/CustomerTicketPicker'
import { useCustomerTickets } from '../../hooks/useCustomerTickets'
import { apiErrorMessage } from '../../api/client'
import { Can } from '../../components/PermissionGate'

const FIELD_TYPES: Array<{ value: FormFieldType; label: string }> = [
  { value: 'TEXT', label: 'Short text' },
  { value: 'TEXTAREA', label: 'Paragraph' },
  { value: 'NUMBER', label: 'Number' },
  { value: 'DATE', label: 'Date' },
  { value: 'SELECT', label: 'Dropdown' },
  { value: 'RADIO', label: 'Choice' },
  { value: 'CHECKBOX', label: 'Checkbox' },
]

export function FormsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [creatingTicket, setCreatingTicket] = useState(() => new URLSearchParams(location.search).get('create') === 'customer-ticket')
  const [editing, setEditing] = useState<FormDef | null>(null)
  const [confirm, setConfirm] = useState<FormDef | null>(null)
  const [viewing, setViewing] = useState<FormDef | null>(null)
  const [submitting, setSubmitting] = useState<FormDef | null>(null)
  const [linking, setLinking] = useState<FormDef | null>(null)
  const [branchFilter, setBranchFilter] = useState('')

  useEffect(() => {
    if (new URLSearchParams(location.search).get('create') !== 'customer-ticket') return
    setCreatingTicket(true)
    navigate(location.pathname, { replace: true })
  }, [location, navigate])

  const branches = useQuery({ queryKey: ['branches'], queryFn: () => branchesApi.list() })
  const forms = useQuery({
    queryKey: ['forms', branchFilter],
    queryFn: () => formsApi.list({ branchId: branchFilter || undefined }),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['forms'] })

  const save = useMutation({
    mutationFn: (body: { name: string; description?: string | null; branchId?: string | null; isCustomerTicket?: boolean; parentFormId?: string | null; fields: Array<Omit<FormField, 'id'>> }) =>
      formsApi.create({ name: body.name, description: body.description ?? null, branchId: body.branchId ?? null, isCustomerTicket: body.isCustomerTicket, parentFormId: body.parentFormId ?? null, fields: body.fields }),
    onSuccess: () => { setCreating(false); setCreatingTicket(false); invalidate() },
  })

  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { name: string; description?: string | null; isCustomerTicket?: boolean; parentFormId?: string | null; fields: Array<Omit<FormField, 'id'>> } }) =>
      formsApi.update(id, body),
    onSuccess: () => { setEditing(null); invalidate() },
  })

  const publish = useMutation({
    mutationFn: (id: string) => formsApi.publish(id),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (id: string) => formsApi.remove(id),
    onSuccess: () => { setConfirm(null); invalidate() },
  })

  const rows = forms.data ?? []
  const ticketForms = rows.filter((f) => f.isCustomerTicket)

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" fontWeight={700}>Forms</Typography>
        <Can permissions={['form.create']}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating(true)}>
            New form
          </Button>
        </Can>
      </Stack>

      <TextField select label="Filter by branch" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} size="small" sx={{ mb: 2, minWidth: 220, width: { xs: '100%', sm: 'auto' } }}>
        <MenuItem value="">All branches</MenuItem>
        {(branches.data ?? []).map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
      </TextField>

      {(save.error || update.error || remove.error || publish.error) && (
        <Alert severity="error" sx={{ mb: 2 }}>{apiErrorMessage(save.error ?? update.error ?? remove.error ?? publish.error)}</Alert>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Branch</TableCell>
              <TableCell>Fields</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((f) => (
              <TableRow key={f.id} hover>
                <TableCell>{f.name}</TableCell>
                <TableCell>{f.branch?.name ?? 'All'}</TableCell>
                <TableCell>{f.fields.length}</TableCell>
                <TableCell><Chip label={f.isPublished ? 'Published' : 'Draft'} size="small" color={f.isPublished ? 'success' : 'default'} /></TableCell>
                <TableCell align="right">
                  <Can permissions={['form.submit']}>
                    {f.isPublished && (
                      <IconButton title="Fill & submit" onClick={() => setSubmitting(f)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Can>
                  <Can permissions={['form.view']}>
                    <IconButton title="View submissions" onClick={() => setViewing(f)}><VisibilityIcon fontSize="small" /></IconButton>
                  </Can>
                  <Can permissions={['form.manage']}>
                    {f.isCustomerTicket && (
                      <IconButton title="Link forms to this Customer Ticket" onClick={() => setLinking(f)}><LinkIcon fontSize="small" /></IconButton>
                    )}
                    <IconButton title="Edit form" onClick={() => setEditing(f)}><EditIcon fontSize="small" /></IconButton>
                    {!f.isPublished && (
                      <IconButton title="Publish" onClick={() => publish.mutate(f.id)}><PublishIcon fontSize="small" /></IconButton>
                    )}
                    <IconButton color="error" onClick={() => setConfirm(f)}><DeleteIcon fontSize="small" /></IconButton>
                  </Can>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={5} align="center">No forms</TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>

      {(creating || creatingTicket) && (
        <FormDialog
          ticketForms={ticketForms}
          defaultIsTicket={creatingTicket}
          branchOptions={(branches.data ?? []).map((b) => ({ id: b.id, name: b.name }))}
          onClose={() => { setCreating(false); setCreatingTicket(false) }}
          onSave={(body) => save.mutate(body)}
          busy={save.isPending}
          error={save.error}
        />
      )}

      {editing && (
        <FormDialog
          initial={editing}
          ticketForms={ticketForms}
          branchOptions={(branches.data ?? []).map((b) => ({ id: b.id, name: b.name }))}
          onClose={() => setEditing(null)}
          onSave={(body) => update.mutate({ id: editing.id, body })}
          busy={update.isPending}
          error={update.error}
        />
      )}

      {linking && (
        <LinkChildrenDialog
          form={linking}
          forms={rows}
          onClose={() => setLinking(null)}
        />
      )}

      {viewing && <SubmissionsDialog form={viewing} onClose={() => setViewing(null)} />}

      {submitting && (
        <SubmitDialog
          form={submitting}
          onClose={() => setSubmitting(null)}
          onSubmitted={invalidate}
        />
      )}

      <Dialog open={confirm !== null} onClose={() => setConfirm(null)}>
        <DialogTitle>Delete form</DialogTitle>
        <DialogContent>Delete "{confirm?.name}"?</DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>Cancel</Button>
          <Button color="error" onClick={() => confirm && remove.mutate(confirm.id)}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

interface FieldDraft {
  key: string
  label: string
  type: FormFieldType
  required: boolean
  options: string
  section: string
  roleKey: string
}

function FormDialog({
  branchOptions,
  ticketForms = [],
  defaultIsTicket = false,
  onClose,
  onSave,
  busy,
  error,
  initial,
}: {
  branchOptions: Array<{ id: string; name: string }>
  ticketForms?: Array<{ id: string; name: string }>
  defaultIsTicket?: boolean
  onClose: () => void
  onSave: (body: { name: string; description?: string | null; branchId?: string | null; isCustomerTicket?: boolean; parentFormId?: string | null; fields: Array<Omit<FormField, 'id'>> }) => void
  busy: boolean
  error: unknown
  initial?: FormDef | null
}) {
  const isEditing = !!initial
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [branchId, setBranchId] = useState(initial?.branchId ?? '')
  const [isCustomerTicket, setIsCustomerTicket] = useState(initial?.isCustomerTicket ?? defaultIsTicket)
  const [parentFormId, setParentFormId] = useState(initial?.parentFormId ?? '')
  const [fields, setFields] = useState<FieldDraft[]>(() =>
    initial && initial.fields.length > 0
      ? initial.fields.map((f) => ({
          key: f.key,
          label: f.label,
          type: f.type,
          required: f.required ?? false,
          options: (f.options ?? []).join(', '),
          section: f.section ?? 'General',
          roleKey: f.roleKey ?? '',
        }))
      : [emptyField()]
  )

  const setField = (i: number, patch: Partial<FieldDraft>) => {
    setFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)))
  }

  const canSave = name && fields.every((f) => f.key && f.label)
  const saveHint = !name
    ? 'A form name is required to save.'
    : fields.some((f) => !f.key || !f.label)
      ? 'Every field needs both a Key and a Label.'
      : ''

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md" sx={{ '& .MuiDialog-paper': { maxHeight: '90vh' } }}>
      <DialogTitle>{isEditing ? 'Edit form' : 'New form'}</DialogTitle>
      <DialogContent sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 1.5, sm: 2 } }}>
        {error ? <Alert severity="error" sx={{ mb: 2 }}>{apiErrorMessage(error)}</Alert> : null}
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
            <TextField select label="Branch" value={branchId} onChange={(e) => setBranchId(e.target.value)} sx={{ minWidth: 200, width: { xs: '100%', sm: 'auto' } }}>
              <MenuItem value="">All branches</MenuItem>
              {branchOptions.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
            </TextField>
          </Stack>
          <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'flex-start', sm: 'center' }}>
            <Typography variant="body2">Customer Ticket (parent) form</Typography>
            <Switch
              checked={isCustomerTicket}
              onChange={(e) => {
                setIsCustomerTicket(e.target.checked)
                if (e.target.checked) setParentFormId('')
              }}
            />
            <Typography variant="caption" color="text.secondary">
              Forms linked to this form will carry this Customer Ticket's unique REFF.
            </Typography>
          </Stack>

          {!isCustomerTicket && ticketForms.length > 0 && (
            <TextField
              select
              label="Linked Customer Ticket (parent)"
              value={parentFormId}
              onChange={(e) => setParentFormId(e.target.value)}
              fullWidth
              helperText="Link this form to a Customer Ticket so submissions must carry the parent's REFF."
            >
              <MenuItem value="">None</MenuItem>
              {ticketForms.map((t) => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
            </TextField>
          )}

          <Divider />
          <Typography variant="subtitle1" fontWeight={700}>Fields</Typography>
          {fields.map((f, i) => (
            <Box key={i} sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}>
              <Stack spacing={1}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <TextField size="small" label="Key" value={f.key} onChange={(e) => setField(i, { key: e.target.value })} sx={{ width: { xs: '100%', sm: 180 } }} />
                  <TextField size="small" label="Label" value={f.label} onChange={(e) => setField(i, { label: e.target.value })} fullWidth />
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                  <TextField select size="small" label="Type" value={f.type} onChange={(e) => setField(i, { type: e.target.value as FormFieldType })} sx={{ width: { xs: '100%', sm: 180 } }}>
                    {FIELD_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                  </TextField>
                  {(f.type === 'SELECT' || f.type === 'RADIO') && (
                    <TextField size="small" label="Options (comma separated)" value={f.options} onChange={(e) => setField(i, { options: e.target.value })} fullWidth />
                  )}
                  {f.type === 'CHECKBOX' && (
                    <Typography variant="body2" color="text.secondary">Checkbox field</Typography>
                  )}
                  <Stack direction="row" alignItems="center" sx={{ whiteSpace: 'nowrap' }}>
                    <Typography variant="body2">Required</Typography>
                    <Switch checked={f.required} onChange={(e) => setField(i, { required: e.target.checked })} />
                  </Stack>
                  <IconButton color="error" disabled={fields.length === 1} onClick={() => setFields((prev) => prev.filter((_, idx) => idx !== i))}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <TextField size="small" label="Section" value={f.section} onChange={(e) => setField(i, { section: e.target.value })} fullWidth />
                  <TextField select size="small" label="Filled by role" value={f.roleKey} onChange={(e) => setField(i, { roleKey: e.target.value })} sx={{ width: { xs: '100%', sm: 240 } }}>
                    <MenuItem value="">General (secretary)</MenuItem>
                    {ROLE_SECTION_KEYS.map((rk) => <MenuItem key={rk} value={rk}>{rk.replace(/_/g, ' ')}</MenuItem>)}
                  </TextField>
                </Stack>
              </Stack>
            </Box>
          ))}
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setFields((prev) => [...prev, emptyField()])} sx={{ alignSelf: 'flex-start' }}>
            Add field
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 2 }, flexWrap: 'wrap' }}>
        {saveHint && <Typography variant="body2" color="text.secondary" sx={{ mr: 'auto' }}>{saveHint}</Typography>}
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={busy || !canSave}
          onClick={() => onSave({
            name,
            description: description || null,
            branchId: branchId || null,
            isCustomerTicket,
            parentFormId: isCustomerTicket ? null : (parentFormId || null),
            fields: fields.map((f, i) => ({
              key: f.key,
              label: f.label,
              type: f.type,
              required: f.required,
              order: i,
              section: f.section || 'General',
              roleKey: (f.roleKey || null) as import('../../api/forms').RoleKey | null,
              ...((f.type === 'SELECT' || f.type === 'RADIO')
                ? { options: f.options.split(',').map((o) => o.trim()).filter(Boolean) }
                : {}),
            })),
          })}
        >
          {isEditing ? (busy ? 'Saving…' : 'Save') : (busy ? 'Creating…' : 'Create')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function emptyField(): FieldDraft {
  return { key: '', label: '', type: 'TEXT', required: false, options: '', section: 'General', roleKey: '' }
}

function SubmitDialog({
  form,
  onClose,
  onSubmitted,
}: {
  form: FormDef
  onClose: () => void
  onSubmitted: () => void
}) {
  const isChild = isChildFormDef(form)
  const qc = useQueryClient()
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [parentRefNumber, setParentRefNumber] = useState('')
  const [result, setResult] = useState<FormSubmission | null>(null)
  const [error, setError] = useState('')

  const tickets = useQuery({
    queryKey: ['formSubmissions', form.parentFormId ?? null],
    queryFn: () => formsApi.listSubmissions(form.parentFormId as string),
    enabled: isChild && !!form.parentFormId,
  })
  const { tickets: allTickets, loading: allTicketsLoading, ticketForms } = useCustomerTickets()

  const submit = useMutation({
    mutationFn: () => {
      const data: Record<string, unknown> = { ...values }
      if (isChild) data.parentRefNumber = parentRefNumber.trim()
      return formsApi.submit(form.id, data)
    },
    onSuccess: (res) => { setResult(res); onSubmitted() },
    onError: (e) => setError(apiErrorMessage(e)),
  })

  const setValue = (key: string, value: unknown) => setValues((prev) => ({ ...prev, [key]: value }))

  const missing = form.fields.filter((f) => f.required && !isRoleSection(f) && (values[f.key] === undefined || values[f.key] === null || values[f.key] === ''))
  // All form details are optional; only a required parent ticket (for bound
  // child forms) gates submission.
  const canSubmit = !isChild || parentRefNumber.trim().length > 0
  const sections = Array.from(new Set(form.fields.map((f) => f.section || 'General')))

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{isChild ? `Submit ${form.name} (bundled form)` : `Submit ${form.name}`}</DialogTitle>
      <DialogContent sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 1.5, sm: 2 } }}>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
        {result && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Submitted successfully. REFF: <strong>{result.refNumber}</strong>
            {result.parentRefNumber ? ` (bundled under ${result.parentRefNumber})` : ''}
          </Alert>
        )}
        <Stack spacing={2} sx={{ pt: 1 }}>
          {isChild && (
            <CustomerTicketPicker
              tickets={form.parentFormId ? (tickets.data ?? []) : allTickets}
              loading={form.parentFormId ? tickets.isLoading : allTicketsLoading}
              ticketForms={ticketForms}
              value={parentRefNumber}
              onChange={setParentRefNumber}
              onTicketCreated={() => qc.invalidateQueries({ queryKey: ['formSubmissions'] })}
              helperText={form.parentFormId
                ? 'Select the Customer Ticket this form should be bundled under. It shares the ticket REFF.'
                : 'Search for an existing Customer Ticket to link this form to, or create a new one.'}
            />
          )}
          {sections.map((section) => (
            <Box key={section}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mt: 1 }}>
                {section}
              </Typography>
              <Stack spacing={2}>
                {form.fields.filter((f) => (f.section || 'General') === section).map((f) => (
                  <FormFieldInput
                    key={f.key}
                    field={f}
                    value={values[f.key]}
                    disabled={!!result || isRoleSection(f)}
                    onChange={(v) => setValue(f.key, v)}
                  />
                ))}
              </Stack>
            </Box>
          ))}
          {missing.length > 0 && !result && (
            <Typography variant="body2" color="error">Optional fields not filled: {missing.map((f) => f.label).join(', ')}</Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 2 }, flexWrap: 'wrap' }}>
        <Button onClick={onClose}>{result ? 'Close' : 'Cancel'}</Button>
        {!result && (
          <Button variant="contained" disabled={submit.isPending || !canSubmit} onClick={() => submit.mutate()}>
            {submit.isPending ? 'Submitting…' : 'Submit'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}

function SubmissionsDialog({ form, onClose }: { form: FormDef; onClose: () => void }) {
  const submissions = useQuery({
    queryKey: ['form-submissions', form.id],
    queryFn: () => formsApi.listSubmissions(form.id),
  })

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Submissions for {form.name}</DialogTitle>
      <DialogContent>
        <List dense>
          {(submissions.data ?? []).map((s) => (
            <ListItem key={s.id} alignItems="flex-start" sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <ListItemText
                primary={
                  <Typography component="span" variant="body2" fontWeight={600}>
                    {s.refNumber ?? '(no REFF)'} —{' '}
                    {`${s.submittedByUser?.firstName ?? ''} ${s.submittedByUser?.lastName ?? ''}`.trim() || s.submittedByUserId}
                  </Typography>
                }
                secondary={
                  <Typography component="span" variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                    {s.parentRefNumber ? `Bundled under: ${s.parentRefNumber}\n` : ''}
                    {new Date(s.createdAt).toLocaleString()}{'\n'}{JSON.stringify(s.data, null, 2)}
                  </Typography>
                }
              />
            </ListItem>
          ))}
          {(submissions.data ?? []).length === 0 && <Alert severity="info">No submissions yet.</Alert>}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}

function LinkChildrenDialog({
  form,
  forms,
  onClose,
}: {
  form: FormDef
  forms: FormDef[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const candidates = forms.filter((f) => f.id !== form.id && !f.isCustomerTicket)
  const [selected, setSelected] = useState<Set<string>>(() => {
    const s = new Set<string>()
    ;(form.childForms ?? []).forEach((c) => s.add(c.id))
    return s
  })
  const [error, setError] = useState('')

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const save = useMutation({
    mutationFn: async () => {
      for (const f of candidates) {
        const linked = selected.has(f.id)
        if (linked && f.parentFormId !== form.id) {
          await formsApi.update(f.id, { parentFormId: form.id })
        } else if (!linked && f.parentFormId === form.id) {
          await formsApi.update(f.id, { parentFormId: null })
        }
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['forms'] }); onClose() },
    onError: (e) => setError(e instanceof Error ? e.message : 'Failed to update links'),
  })

  return (
    <Dialog open onClose={save.isPending ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Link forms to {form.name}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {candidates.length === 0
            ? 'There are no other forms to link. Create more forms first.'
            : 'Check the forms that should be bundled under this Customer Ticket. Their submissions will require this ticket\'s unique REFF.'}
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
        <List dense>
          {candidates.map((f) => {
            const isLinked = selected.has(f.id)
            const wasLinked = (form.childForms ?? []).some((c) => c.id === f.id)
            return (
              <ListItem key={f.id} sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={isLinked}
                      onChange={() => toggle(f.id)}
                      indeterminate={!isLinked && wasLinked && f.parentFormId === form.id}
                    />
                  }
                  label={<Typography variant="body2">{f.name}</Typography>}
                  sx={{ width: '100%' }}
                />
              </ListItem>
            )
          })}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={save.isPending}>Cancel</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? 'Saving...' : 'Save links'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
