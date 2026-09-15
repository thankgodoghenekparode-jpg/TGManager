import { useMemo, useState } from 'react'
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
  IconButton,
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
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import HistoryIcon from '@mui/icons-material/History'
import KeyIcon from '@mui/icons-material/Key'
import LinkIcon from '@mui/icons-material/Link'
import { integrationsApi, WEBHOOK_EVENTS, type ApiKeyCreated, type WebhookRecord } from '../../api/integrations'
import { permissionsApi } from '../../api/permissions'
import { apiErrorMessage } from '../../api/client'
import { Can } from '../../components/PermissionGate'

export function IntegrationsPage() {
  const qc = useQueryClient()
  const [keyDialog, setKeyDialog] = useState(false)
  const [hookDialog, setHookDialog] = useState(false)
  const [createdKey, setCreatedKey] = useState<ApiKeyCreated | null>(null)
  const [revoking, setRevoking] = useState<{ id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState<WebhookRecord | null>(null)
  const [deliveries, setDeliveries] = useState<WebhookRecord | null>(null)

  const keys = useQuery({ queryKey: ['integrations', 'keys'], queryFn: () => integrationsApi.listApiKeys() })
  const webhooks = useQuery({ queryKey: ['integrations', 'webhooks'], queryFn: () => integrationsApi.listWebhooks() })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['integrations'] })
  }

  const revoke = useMutation({
    mutationFn: (id: string) => integrationsApi.revokeApiKey(id),
    onSuccess: () => { setRevoking(null); invalidate() },
  })

  const removeHook = useMutation({
    mutationFn: (id: string) => integrationsApi.removeWebhook(id),
    onSuccess: () => { setDeleting(null); invalidate() },
  })

  const error = revoke.error ?? removeHook.error

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" fontWeight={700}>Integrations</Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        API keys let external systems start and advance workflows; webhooks notify them about workflow events.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{apiErrorMessage(error)}</Alert>}

      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1, mt: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h6" fontWeight={700}><KeyIcon fontSize="small" sx={{ verticalAlign: -3, mr: 0.5 }} />API Keys</Typography>
        <Can permissions={['integration.manage']}>
          <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setKeyDialog(true)}>New key</Button>
        </Can>
      </Stack>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Prefix</TableCell>
              <TableCell>Permissions</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Last used</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(keys.data ?? []).map((k) => (
              <TableRow key={k.id} hover>
                <TableCell>{k.name}</TableCell>
                <TableCell><code>{k.keyPrefix}…</code></TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {(k.permissions.length > 0 ? k.permissions : ['(no restrictions)']).slice(0, 4).map((p) => (
                      <Chip key={p} label={p} size="small" variant="outlined" />
                    ))}
                  </Stack>
                </TableCell>
                <TableCell><Chip label={k.isActive ? 'Active' : 'Revoked'} size="small" color={k.isActive ? 'success' : 'default'} /></TableCell>
                <TableCell>{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : 'Never'}</TableCell>
                <TableCell align="right">
                  <Can permissions={['integration.manage']}>
                    {k.isActive && (
                      <IconButton size="small" color="error" title="Revoke" onClick={() => setRevoking({ id: k.id, name: k.name })}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Can>
                </TableCell>
              </TableRow>
            ))}
            {keys.data?.length === 0 && <TableRow><TableCell colSpan={6} align="center">No API keys yet{keys.isLoading ? '…' : ''}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>

      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1, mt: 3, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h6" fontWeight={700}><LinkIcon fontSize="small" sx={{ verticalAlign: -3, mr: 0.5 }} />Webhooks</Typography>
        <Can permissions={['integration.manage']}>
          <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setHookDialog(true)}>New webhook</Button>
        </Can>
      </Stack>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>URL</TableCell>
              <TableCell>Events</TableCell>
              <TableCell>Deliveries</TableCell>
              <TableCell>Created</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(webhooks.data ?? []).map((w) => (
              <TableRow key={w.id} hover>
                <TableCell sx={{ wordBreak: 'break-all' }}>{w.url}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {w.events.map((e) => <Chip key={e} label={e} size="small" variant="outlined" />)}
                  </Stack>
                </TableCell>
                <TableCell>{w._count?.deliveries ?? 0}</TableCell>
                <TableCell>{new Date(w.createdAt).toLocaleDateString()}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" title="Deliveries" onClick={() => setDeliveries(w)}><HistoryIcon fontSize="small" /></IconButton>
                  <Can permissions={['integration.manage']}>
                    <IconButton size="small" color="error" title="Delete" onClick={() => setDeleting(w)}><DeleteIcon fontSize="small" /></IconButton>
                  </Can>
                </TableCell>
              </TableRow>
            ))}
            {webhooks.data?.length === 0 && <TableRow><TableCell colSpan={5} align="center">No webhooks yet{webhooks.isLoading ? '…' : ''}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>

      {keyDialog && (
        <CreateKeyDialog
          onClose={() => setKeyDialog(false)}
          onCreated={(key) => { setKeyDialog(false); setCreatedKey(key); invalidate() }}
        />
      )}
      {createdKey && (
        <KeyResultDialog
          apiKey={createdKey}
          onClose={() => setCreatedKey(null)}
        />
      )}
      {hookDialog && (
        <CreateWebhookDialog
          onClose={() => setHookDialog(false)}
          onCreated={() => { setHookDialog(false); invalidate() }}
        />
      )}
      {revoking && (
        <Dialog open onClose={() => setRevoking(null)}>
          <DialogTitle>Revoke API key</DialogTitle>
          <DialogContent>Revoke "{revoking.name}"? Existing integrations using it will stop working immediately.</DialogContent>
          <DialogActions>
            <Button onClick={() => setRevoking(null)}>Cancel</Button>
            <Button color="error" disabled={revoke.isPending} onClick={() => revoke.mutate(revoking.id)}>Revoke</Button>
          </DialogActions>
        </Dialog>
      )}
      {deleting && (
        <Dialog open onClose={() => setDeleting(null)}>
          <DialogTitle>Delete webhook</DialogTitle>
          <DialogContent>Delete webhook to {deleting.url} and its delivery history?</DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleting(null)}>Cancel</Button>
            <Button color="error" disabled={removeHook.isPending} onClick={() => removeHook.mutate(deleting.id)}>Delete</Button>
          </DialogActions>
        </Dialog>
      )}
      {deliveries && <DeliveriesDialog webhook={deliveries} onClose={() => setDeliveries(null)} />}
    </Box>
  )
}

function CreateKeyDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (key: ApiKeyCreated) => void }) {
  const [name, setName] = useState('')
  const [permissions, setPermissions] = useState<string[]>([])
  const [error, setError] = useState('')
  const catalog = useQuery({ queryKey: ['permission-catalog'], queryFn: () => permissionsApi.catalog() })

  const permissionOptions = useMemo(() => {
    const all = Object.values(catalog.data?.grouped ?? {}).flat()
    return [...new Set(all)].sort()
  }, [catalog.data])

  const create = useMutation({
    mutationFn: () => integrationsApi.createApiKey({ name, permissions }),
    onSuccess: onCreated,
    onError: (e) => setError(apiErrorMessage(e)),
  })

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>New API key</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth helperText="A label you can recognize later." />
          <TextField
            select
            label="Permissions"
            value={permissions}
            onChange={(e) => setPermissions(e.target.value as unknown as string[])}
            fullWidth
            SelectProps={{ multiple: true }}
            helperText="Optional. Leave empty to allow the key access to all workflow functions."
          >
            {permissionOptions.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
          </TextField>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={create.isPending || !name} onClick={() => create.mutate()}>Create</Button>
      </DialogActions>
    </Dialog>
  )
}

function KeyResultDialog({ apiKey, onClose }: { apiKey: ApiKeyCreated; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>API key created</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity="info">
            Copy this key now. It is shown only once — you will not be able to see it again.
          </Alert>
          <TextField
            label="API key"
            value={apiKey.key}
            fullWidth
            InputProps={{ readOnly: true }}
            slotProps={{ input: { style: { fontFamily: 'monospace' } } }}
          />
          <Typography variant="caption" color="text.secondary">
            Send it as the <code>X-Api-Key</code> header to <code>/api/v1/integrations/workflows/*</code>.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => { void navigator.clipboard?.writeText(apiKey.key); setCopied(true) }}>{copied ? 'Copied' : 'Copy key'}</Button>
        <Button variant="contained" onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  )
}

function CreateWebhookDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [url, setUrl] = useState('')
  const [secret, setSecret] = useState('')
  const [events, setEvents] = useState<string[]>([WEBHOOK_EVENTS[0]])
  const [error, setError] = useState('')

  const create = useMutation({
    mutationFn: () => integrationsApi.createWebhook({ url: url.trim(), secret, events }),
    onSuccess: onCreated,
    onError: (e) => setError(apiErrorMessage(e)),
  })

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>New webhook</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="Target URL" value={url} onChange={(e) => setUrl(e.target.value)} fullWidth helperText="Receives POST requests with X-Hub-Signature-256 signing." />
          <TextField label="Signing secret" value={secret} onChange={(e) => setSecret(e.target.value)} fullWidth helperText="At least 16 characters. Used to verify webhook payloads." type="password" />
          <TextField
            select
            label="Events"
            value={events}
            onChange={(e) => setEvents(e.target.value as unknown as string[])}
            fullWidth
            SelectProps={{ multiple: true }}
          >
            {WEBHOOK_EVENTS.map((ev) => <MenuItem key={ev} value={ev}>{ev}</MenuItem>)}
          </TextField>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={create.isPending || !url || secret.length < 16 || events.length === 0} onClick={() => create.mutate()}>Create</Button>
      </DialogActions>
    </Dialog>
  )
}

const DELIVERY_COLORS: Record<string, 'default' | 'warning' | 'success' | 'error'> = {
  PENDING: 'warning',
  DELIVERED: 'success',
  FAILED: 'error',
}

function DeliveriesDialog({ webhook, onClose }: { webhook: WebhookRecord; onClose: () => void }) {
  const [status, setStatus] = useState('')
  const deliveries = useQuery({
    queryKey: ['integrations', 'deliveries', webhook.id, status],
    queryFn: () => integrationsApi.listDeliveries(webhook.id, status || undefined),
  })

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Deliveries · {webhook.url}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
      <TextField select label="Status" size="small" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ width: { xs: '100%', sm: 'auto' }, maxWidth: 220 }}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="PENDING">Pending</MenuItem>
            <MenuItem value="DELIVERED">Delivered</MenuItem>
            <MenuItem value="FAILED">Failed</MenuItem>
          </TextField>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Time</TableCell>
                  <TableCell>Event</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Attempts</TableCell>
                  <TableCell>Error</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(deliveries.data ?? []).map((d) => (
                  <TableRow key={d.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(d.createdAt).toLocaleString()}</TableCell>
                    <TableCell>{d.eventType}</TableCell>
                    <TableCell><Chip label={d.status} size="small" color={DELIVERY_COLORS[d.status] ?? 'default'} /></TableCell>
                    <TableCell>{d.attempts}</TableCell>
                    <TableCell sx={{ maxWidth: 260 }}><Typography variant="caption" sx={{ wordBreak: 'break-word' }}>{d.lastError ?? '—'}</Typography></TableCell>
                  </TableRow>
                ))}
                {deliveries.data?.length === 0 && (
                  <TableRow><TableCell colSpan={5} align="center">No deliveries{deliveries.isLoading ? '…' : ''}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
